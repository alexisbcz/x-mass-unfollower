// X web API client. Runs in the page's MAIN world on x.com so requests are
// same-origin and carry the user's session cookies — exactly like x.com itself.
// No DOM scraping: nothing here depends on X's markup.
(() => {
  if (window.__XMU_API) return;

  // Public bearer token used by the x.com web app (same for every user).
  const FALLBACK_BEARER =
    'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  // Last-known GraphQL query ids; refreshed at runtime from X's JS bundle.
  const FALLBACK_OPS = {
    Following: { id: 'QPaR5ONQTW_KyiEXQCHP4g', features: [], toggles: [] },
  };

  const sleep = (ms, signal) =>
    new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });

  const cookie = (name) => document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))?.[1];

  class XError extends Error {
    constructor(msg, { status, code, retryAt, fatal } = {}) {
      super(msg); this.status = status; this.code = code; this.retryAt = retryAt; this.fatal = fatal;
    }
  }

  let meta = null; // { bearer, ops }
  const extraFeatures = {}; // features X complained were missing

  async function loadMeta(force = false) {
    if (meta && !force) return meta;
    const ops = structuredClone(FALLBACK_OPS);
    let bearer = FALLBACK_BEARER;
    try {
      const src = [...document.scripts].map((s) => s.src).find((s) => /\/client-web[^/]*\/main\.[\w]+\.js/.test(s));
      if (src) {
        const js = await (await fetch(src)).text();
        const b = js.match(/"(AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]+)"/);
        if (b) bearer = b[1];
        for (const op of Object.keys(ops)) {
          const m = js.match(new RegExp(
            'queryId:"([^"]+)",operationName:"' + op + '",operationType:"\\w+",metadata:\\{featureSwitches:\\[([^\\]]*)\\],fieldToggles:\\[([^\\]]*)\\]'));
          if (m) ops[op] = { id: m[1], features: JSON.parse('[' + m[2] + ']'), toggles: JSON.parse('[' + m[3] + ']') };
        }
      }
    } catch (e) {
      console.warn('[XMU] bundle discovery failed, using fallbacks', e);
    }
    meta = { bearer, ops };
    return meta;
  }

  function headers(extra = {}) {
    const ct0 = cookie('ct0');
    if (!ct0) throw new XError('Not logged in to X (no ct0 cookie).', { fatal: true });
    return {
      authorization: 'Bearer ' + meta.bearer,
      'x-csrf-token': ct0,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': document.documentElement.lang || 'en',
      ...extra,
    };
  }

  // Translate an HTTP failure into an XError with a retry hint.
  async function failure(res) {
    let body = null, text = '';
    try { text = await res.text(); body = JSON.parse(text); } catch {}
    const err = body?.errors?.[0];
    const code = err?.code;
    const reset = Number(res.headers.get('x-rate-limit-reset'));
    const msg = err?.message || text.slice(0, 200) || res.statusText;
    if (res.status === 429 || code === 88) {
      return new XError('Rate limited', { status: 429, code, retryAt: reset ? reset * 1000 + 3000 : Date.now() + 15 * 60e3 });
    }
    // 326 = account locked, 344 = daily limit, 64 = suspended, 32/215 = bad auth
    if ([326, 64, 32, 215].includes(code) || res.status === 401) {
      return new XError(`X refused the request (${code ?? res.status}): ${msg}`, { status: res.status, code, fatal: true });
    }
    if (code === 344) {
      return new XError('X daily action limit reached. Try again tomorrow.', { status: res.status, code, fatal: true });
    }
    return new XError(`HTTP ${res.status}${code ? ' code ' + code : ''}: ${msg}`, { status: res.status, code, body });
  }

  function rateInfo(res) {
    const rem = res.headers.get('x-rate-limit-remaining');
    const reset = res.headers.get('x-rate-limit-reset');
    return rem == null ? null : { remaining: Number(rem), limit: Number(res.headers.get('x-rate-limit-limit')), resetAt: Number(reset) * 1000 };
  }

  async function graphql(op, variables, attempt = 0) {
    await loadMeta();
    const o = meta.ops[op];
    const features = Object.fromEntries(o.features.map((f) => [f, false]));
    Object.assign(features, extraFeatures);
    const toggles = Object.fromEntries(o.toggles.map((f) => [f, false]));
    const qs = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
      fieldToggles: JSON.stringify(toggles),
    });
    const res = await fetch(`/i/api/graphql/${o.id}/${op}?${qs}`, { credentials: 'include', headers: headers({ 'content-type': 'application/json' }) });
    if (res.ok) {
      const json = await res.json();
      return { json, rate: rateInfo(res) };
    }
    const err = await failure(res);
    if (attempt < 2) {
      // Self-heal: missing feature flags → add them; unknown query id → rediscover.
      const m = /features cannot be null: ([\w, ]+)/.exec(JSON.stringify(err.body || err.message));
      if (res.status === 400 && m) {
        m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((f) => (extraFeatures[f] = false));
        return graphql(op, variables, attempt + 1);
      }
      if (res.status === 404 || res.status === 400) {
        await loadMeta(true);
        return graphql(op, variables, attempt + 1);
      }
    }
    throw err;
  }

  function viewerId() {
    const twid = decodeURIComponent(cookie('twid') || '');
    const id = twid.replace(/^u=/, '');
    if (!/^\d+$/.test(id)) throw new XError('Could not determine your user id — are you logged in?', { fatal: true });
    return id;
  }

  // Normalise a GraphQL user result (handles old `legacy` and new split schemas).
  function toUser(r) {
    if (!r || r.__typename !== 'User') return null;
    const L = r.legacy || {};
    const rp = r.relationship_perspectives || {};
    return {
      id: r.rest_id,
      handle: r.core?.screen_name ?? L.screen_name,
      name: r.core?.name ?? L.name,
      avatar: r.avatar?.image_url ?? L.profile_image_url_https,
      followers: r.relationship_counts?.followers ?? L.followers_count ?? 0,
      following: r.relationship_counts?.following ?? L.friends_count ?? 0,
      followsYou: Boolean(rp.followed_by ?? L.followed_by),
      youFollow: rp.following ?? L.following ?? true,
      verified: Boolean(r.is_blue_verified || r.verification?.verified || L.verified),
      protected: Boolean(r.privacy?.protected ?? L.protected),
      bio: r.profile_bio?.description ?? L.description ?? '',
    };
  }

  /**
   * Walk the full "Following" list. Calls onPage({users, total}) after each page.
   * Automatically waits out rate limits and retries transient errors.
   */
  /**
   * Lazily page through "Following" (most recently followed first).
   * Yields one array of new users per page; only fetches the next page when the
   * consumer asks for it — so "unfollow 100" doesn't download a 20k-account list.
   */
  async function* followingPages({ onWait, signal } = {}) {
    const userId = viewerId();
    const seen = new Set();
    let cursor = null;
    let emptyPages = 0;
    for (;;) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const vars = { userId, count: 100, includePromotedContent: false };
      if (cursor) vars.cursor = cursor;
      const { json } = await withRetry(() => graphql('Following', vars), { onWait, signal });
      const instr = json?.data?.user?.result?.timeline?.timeline?.instructions || [];
      const entries = instr.flatMap((i) => i.entries || (i.entry ? [i.entry] : []));
      const page = [];
      let next = null;
      for (const e of entries) {
        if (e.entryId?.startsWith('cursor-bottom')) next = e.content?.value;
        const u = toUser(e.content?.itemContent?.user_results?.result);
        if (u && !seen.has(u.id)) { seen.add(u.id); page.push(u); }
      }
      if (page.length) yield page;
      emptyPages = page.length ? 0 : emptyPages + 1;
      // Done when there's no next cursor, the cursor is terminal ("0|..."), or pages stop yielding users.
      if (!next || next === cursor || /^0\|/.test(next) || emptyPages >= 2) return;
      cursor = next;
      await sleep(400 + Math.random() * 600, signal);
    }
  }

  /** Full scan. Calls onPage({users}) after each page. */
  async function scanFollowing({ onPage, onWait, signal } = {}) {
    const all = [];
    for await (const page of followingPages({ onWait, signal })) {
      all.push(...page);
      onPage?.({ users: all });
    }
    return all;
  }

  async function unfollow(userId) {
    await loadMeta();
    const body = new URLSearchParams({ include_profile_interstitial_type: '1', skip_status: 'true', user_id: userId });
    const res = await fetch('/i/api/1.1/friendships/destroy.json', {
      method: 'POST', credentials: 'include', body,
      headers: headers({ 'content-type': 'application/x-www-form-urlencoded' }),
    });
    if (!res.ok) throw await failure(res);
    const j = await res.json().catch(() => ({}));
    return { user: j, rate: rateInfo(res) };
  }

  // Ground truth for "did the unfollow actually stick?" (X sometimes silently no-ops when throttling).
  async function isFollowing(targetId) {
    await loadMeta();
    const qs = new URLSearchParams({ source_id: viewerId(), target_id: targetId });
    const res = await fetch('/i/api/1.1/friendships/show.json?' + qs, { credentials: 'include', headers: headers() });
    if (!res.ok) throw await failure(res);
    const j = await res.json();
    return Boolean(j?.relationship?.source?.following);
  }

  /** Retry transient errors with exponential backoff; sleep through rate limits. */
  async function withRetry(fn, { onWait, signal, tries = 6 } = {}) {
    let delay = 15e3;
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        if (e.name === 'AbortError' || e.fatal) throw e;
        if (e.retryAt) {
          const ms = Math.max(5e3, e.retryAt - Date.now());
          onWait?.(ms, 'Rate limited by X');
          await sleep(ms, signal);
          i = Math.max(0, i - 1); // rate-limit waits don't burn attempts
          continue;
        }
        if (i >= tries - 1) throw e;
        onWait?.(delay, e.message);
        await sleep(delay, signal);
        delay = Math.min(delay * 2, 10 * 60e3);
      }
    }
  }

  window.__XMU_API = { loadMeta, followingPages, scanFollowing, unfollow, isFollowing, withRetry, viewerId, sleep, XError };
})();
