// In-page panel (shadow DOM, so X's CSS can't touch it and ours can't leak).
(() => {
  if (window.__XMU) return;
  const API = window.__XMU_API;

  // ---------- tiny DOM helper (no innerHTML) ----------
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
    return el;
  }
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
  const dur = (ms) => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };

  // ---------- persistent state (per account, in x.com localStorage) ----------
  const DEFAULTS = { minDelay: 3, maxDelay: 7, pauseEvery: 50, pauseMinutes: 3, maxPerRun: 400, verifyEvery: 10, skipVerified: false, minFollowersKeep: 0 };
  let uid = null;
  let S = null;
  // IndexedDB (not localStorage): a 20k-account scan is several MB, beyond localStorage's quota.
  let dbp = null;
  function db() {
    return (dbp ??= new Promise((res, rej) => {
      const r = indexedDB.open('xmu', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => res(req?.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function load() {
    uid = API.viewerId();
    let raw = {};
    try { raw = (await idb('readonly', (st) => st.get('v1:' + uid))) || {}; } catch (e) { console.warn('[XMU] load failed', e); }
    S = { users: [], scannedAt: 0, keep: [], done: {}, history: [], ...raw, settings: { ...DEFAULTS, ...(raw.settings || {}) } };
  }
  let saving = null, saveAgain = false;
  function save() {
    // Coalesce rapid saves; always persist the latest state.
    if (saving) { saveAgain = true; return; }
    saving = idb('readwrite', (st) => st.put(S, 'v1:' + uid))
      .catch((e) => log('Could not save state: ' + e.message, 'warn'))
      .finally(() => { saving = null; if (saveAgain) { saveAgain = false; save(); } });
  }
  const keepSet = () => new Set(S.keep);
  const last24h = () => S.history.filter((t) => t > Date.now() - 864e5).length;

  // ---------- runtime state ----------
  let host, root, els = {};
  let selected = new Set();
  let busy = null; // 'scan' | 'unfollow' | null
  let ctrl = null; // AbortController
  let paused = false;
  let waitUntil = 0, waitReason = '';
  let renderLimit = 200;
  const filter = { q: '', view: 'non', sort: 'recent' };

  // ---------- styles ----------
  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel { position: fixed; top: 12px; right: 12px; bottom: 12px; width: 440px; max-width: calc(100vw - 24px); z-index: 2147483646;
    display: flex; flex-direction: column; background: #000; color: #e7e9ea; border: 1px solid #2f3336; border-radius: 16px;
    font: 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; box-shadow: 0 8px 40px rgba(255,255,255,.08); overflow: hidden; }
  header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #2f3336; }
  header h1 { font-size: 16px; font-weight: 800; margin: 0; flex: 1; }
  header .who { color: #71767b; font-size: 13px; }
  button { font: inherit; cursor: pointer; border-radius: 999px; border: 1px solid #536471; background: transparent; color: #e7e9ea; padding: 6px 14px; font-weight: 700; }
  button:hover:not(:disabled) { background: rgba(231,233,234,.1); }
  button:disabled { opacity: .45; cursor: default; }
  button.primary { background: #e7e9ea; color: #0f1419; border-color: #e7e9ea; }
  button.primary:hover:not(:disabled) { background: #d7dbdc; }
  button.danger { background: #f4212e; border-color: #f4212e; color: #fff; }
  button.danger:hover:not(:disabled) { background: #dc1e29; }
  button.icon { border: 0; padding: 4px 9px; font-size: 18px; line-height: 1; color: #71767b; }
  button.sm { padding: 3px 10px; font-size: 12px; }
  .row { display: flex; gap: 8px; align-items: center; padding: 10px 14px; flex-wrap: wrap; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #2f3336; }
  .stat { padding: 8px 0; text-align: center; }
  .stat b { display: block; font-size: 17px; font-variant-numeric: tabular-nums; }
  .stat span { color: #71767b; font-size: 12px; }
  .status { padding: 8px 14px; font-size: 13px; color: #71767b; border-bottom: 1px solid #2f3336; min-height: 36px; }
  .status.warn { color: #ffd400; } .status.err { color: #f4212e; } .status.ok { color: #00ba7c; }
  .bar { height: 3px; background: #2f3336; } .bar > i { display: block; height: 100%; width: 0; background: #1d9bf0; transition: width .3s; }
  input[type=search], select, input[type=number] { font: inherit; color: #e7e9ea; background: #16181c; border: 1px solid #2f3336; border-radius: 8px; padding: 6px 10px; }
  input[type=search] { flex: 1; min-width: 120px; }
  input:focus, select:focus { outline: 2px solid #1d9bf0; outline-offset: -1px; }
  .tabs { display: flex; border-bottom: 1px solid #2f3336; }
  .tabs button { flex: 1; border: 0; border-radius: 0; padding: 10px 4px; color: #71767b; font-size: 13px; border-bottom: 3px solid transparent; }
  .tabs button.on { color: #e7e9ea; border-bottom-color: #1d9bf0; }
  .list { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
  .empty { padding: 32px 20px; text-align: center; color: #71767b; }
  .u { display: grid; grid-template-columns: 22px 40px 1fr auto; gap: 10px; align-items: center; padding: 8px 14px; border-bottom: 1px solid #16181c; }
  .u:hover { background: #080808; }
  .u.done { opacity: .4; } .u.kept { background: rgba(0,186,124,.06); }
  .u img { width: 40px; height: 40px; border-radius: 50%; background: #2f3336; }
  .u .n { overflow: hidden; min-width: 0; }
  .u .n a { color: #e7e9ea; font-weight: 700; text-decoration: none; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .u .n a:hover { text-decoration: underline; }
  .u .n small { color: #71767b; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .u .badge { color: #1d9bf0; } .u .tag { font-size: 11px; color: #00ba7c; font-weight: 700; } .u .tag.x { color: #71767b; }
  input[type=checkbox] { width: 16px; height: 16px; accent-color: #1d9bf0; margin: 0; }
  footer { border-top: 1px solid #2f3336; padding: 10px 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  footer .grow { flex: 1; }
  details { border-top: 1px solid #2f3336; }
  details summary { cursor: pointer; padding: 8px 14px; color: #71767b; font-size: 13px; }
  .settings { display: grid; grid-template-columns: 1fr 90px; gap: 6px 10px; padding: 4px 14px 12px; font-size: 13px; align-items: center; }
  .settings input[type=number] { width: 90px; padding: 4px 8px; }
  .log { max-height: 120px; overflow: auto; padding: 0 14px 10px; font: 12px/1.4 ui-monospace, monospace; color: #71767b; }
  .log .warn { color: #ffd400; } .log .err { color: #f4212e; } .log .ok { color: #00ba7c; }
  .sentinel { height: 1px; }
  `;

  // ---------- build UI ----------
  function build() {
    host = h('div', { id: 'xmu-host' });
    root = host.attachShadow({ mode: 'open' });
    root.append(h('style', {}, CSS));

    const num = (k, label, min, max, step = 1) => [
      h('label', { htmlFor: 'set-' + k }, label),
      h('input', { type: 'number', id: 'set-' + k, min, max, step, value: S.settings[k],
        onchange: (e) => { S.settings[k] = Math.max(min, Math.min(max, Number(e.target.value) || 0)); e.target.value = S.settings[k]; save(); } }),
    ];
    const chk = (k, label) => [
      h('label', { htmlFor: 'set-' + k }, label),
      h('input', { type: 'checkbox', id: 'set-' + k, checked: S.settings[k], onchange: (e) => { S.settings[k] = e.target.checked; save(); render(); } }),
    ];

    els.panel = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Unfollow non-followers' },
      h('header', {},
        h('h1', {}, 'Unfollow non-followers'),
        h('button', { class: 'icon', title: 'Close', 'aria-label': 'Close', onclick: () => toggle(false) }, '×')),
      h('div', { class: 'stats' },
        stat('following', 'Following'), stat('non', 'Not following back'), stat('sel', 'Selected'), stat('day', 'Unfollowed 24h')),
      els.bar = h('div', { class: 'bar' }, h('i')),
      els.status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' }),
      h('div', { class: 'row' },
        els.scanBtn = h('button', { onclick: scan, title: 'Load everyone you follow to review before unfollowing' }, 'Full scan'),
        els.quickBtn = h('button', { class: 'primary', onclick: () => runUnfollow({ quick: true }), title: 'Scan only as far as needed and unfollow non-followers as they are found (newest follows first). Uses “Stop after N” from settings.' }, 'Quick unfollow'),
        els.quickN = h('input', { type: 'number', min: 1, max: 5000, value: S.settings.maxPerRun, 'aria-label': 'How many to unfollow', title: 'How many to unfollow',
          style: 'width:80px', onchange: (e) => { S.settings.maxPerRun = Math.max(1, Math.min(5000, Number(e.target.value) || 1)); e.target.value = S.settings.maxPerRun; const f = root.getElementById('set-maxPerRun'); if (f) f.value = S.settings.maxPerRun; save(); } }),
        els.search = h('input', { type: 'search', placeholder: 'Filter by name, @handle, bio', oninput: (e) => { filter.q = e.target.value.toLowerCase(); renderLimit = 200; render(); } }),
        els.sort = h('select', { 'aria-label': 'Sort', onchange: (e) => { filter.sort = e.target.value; render(); } },
          h('option', { value: 'recent' }, 'Recently followed'),
          h('option', { value: 'oldest' }, 'Oldest follows'),
          h('option', { value: 'fewest' }, 'Fewest followers'),
          h('option', { value: 'most' }, 'Most followers'))),
      els.tabs = h('div', { class: 'tabs', role: 'tablist' },
        tab('non', 'Not following back'), tab('kept', 'Kept'), tab('done', 'Unfollowed'), tab('all', 'All')),
      h('div', { class: 'row', style: 'padding-top:6px;padding-bottom:6px' },
        h('button', { class: 'sm', onclick: () => selectVisible(true) }, 'Select all'),
        h('button', { class: 'sm', onclick: () => selectVisible(false) }, 'Select none'),
        h('button', { class: 'sm', title: 'Keep selected accounts: they will never be unfollowed', onclick: keepSelected }, 'Keep selected'),
        h('button', { class: 'sm', onclick: exportCsv }, 'Export CSV')),
      els.list = h('div', { class: 'list' }),
      h('footer', {},
        els.runInfo = h('span', { class: 'grow', style: 'color:#71767b;font-size:13px' }),
        els.pauseBtn = h('button', { onclick: togglePause, disabled: true }, 'Pause'),
        els.stopBtn = h('button', { onclick: stop, disabled: true }, 'Stop'),
        els.goBtn = h('button', { class: 'danger', onclick: () => runUnfollow() }, 'Unfollow')),
      h('details', {},
        h('summary', {}, 'Pacing & safety settings'),
        h('div', { class: 'settings' },
          ...num('minDelay', 'Min delay between unfollows (s)', 1, 600),
          ...num('maxDelay', 'Max delay between unfollows (s)', 1, 900),
          ...num('pauseEvery', 'Take a break every N unfollows', 0, 1000),
          ...num('pauseMinutes', 'Break length (minutes)', 0, 120),
          ...num('maxPerRun', 'Stop after N unfollows per run', 1, 5000),
          ...num('verifyEvery', 'Verify it really worked every N (0 = off)', 0, 1000),
          ...num('minFollowersKeep', 'Auto-keep accounts with ≥ N followers (0 = off)', 0, 1e9),
          ...chk('skipVerified', 'Auto-keep verified accounts'))),
      h('details', { open: false },
        h('summary', {}, 'Activity log'),
        els.log = h('div', { class: 'log' })),
    );
    root.append(els.panel);
    document.documentElement.append(host);

    els.list.addEventListener('change', onListChange);
    els.list.addEventListener('scroll', () => {
      if (els.list.scrollTop + els.list.clientHeight > els.list.scrollHeight - 400) { renderLimit += 200; render(true); }
    });
    setInterval(tick, 1000);
  }
  function stat(k, label) { return h('div', { class: 'stat' }, (els['st_' + k] = h('b', {}, '–')), h('span', {}, label)); }
  function tab(k, label) {
    return (els['tab_' + k] = h('button', { role: 'tab', class: filter.view === k ? 'on' : '', onclick: () => { filter.view = k; renderLimit = 200; render(); } }, label));
  }

  // ---------- helpers ----------
  function log(msg, cls = '') {
    console.log('[XMU]', msg);
    if (!els.log) return;
    const line = h('div', { class: cls }, new Date().toLocaleTimeString() + '  ' + msg);
    els.log.prepend(line);
    while (els.log.childElementCount > 300) els.log.lastChild.remove();
  }
  function status(msg, cls = '') { els.status.textContent = msg; els.status.className = 'status ' + cls; }
  function progress(frac) { els.bar.firstChild.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; }

  function autoKept(u) {
    return (S.settings.skipVerified && u.verified) || (S.settings.minFollowersKeep > 0 && u.followers >= S.settings.minFollowersKeep);
  }
  function isKept(u, ks = keepSet()) { return ks.has(u.id) || autoKept(u); }
  // Candidates = not following you, not unfollowed yet, not kept.
  function candidates() { const ks = keepSet(); return S.users.filter((u) => !u.followsYou && !S.done[u.id] && !isKept(u, ks)); }

  function visibleUsers() {
    const ks = keepSet();
    let list = S.users.filter((u) => {
      if (filter.view === 'non') return !u.followsYou && !S.done[u.id] && !isKept(u, ks);
      if (filter.view === 'kept') return isKept(u, ks) && !S.done[u.id];
      if (filter.view === 'done') return !!S.done[u.id];
      return true;
    });
    if (filter.q) list = list.filter((u) => (u.name + ' ' + u.handle + ' ' + u.bio).toLowerCase().includes(filter.q));
    if (filter.sort === 'oldest') list = list.slice().reverse();
    else if (filter.sort === 'fewest') list = list.slice().sort((a, b) => a.followers - b.followers);
    else if (filter.sort === 'most') list = list.slice().sort((a, b) => b.followers - a.followers);
    return list;
  }

  // ---------- render ----------
  function render(append = false) {
    if (!els.list) return;
    const ks = keepSet();
    const list = visibleUsers();
    els.st_following.textContent = S.users.length ? fmt(S.users.length) : '–';
    els.st_non.textContent = S.users.length ? fmt(S.users.filter((u) => !u.followsYou && !S.done[u.id]).length) : '–';
    els.st_sel.textContent = fmt(selected.size);
    els.st_day.textContent = fmt(last24h());
    for (const k of ['non', 'kept', 'done', 'all']) els['tab_' + k].className = filter.view === k ? 'on' : '';
    els.goBtn.disabled = !!busy || selected.size === 0;
    els.goBtn.textContent = selected.size ? `Unfollow ${fmt(selected.size)}` : 'Unfollow';
    els.scanBtn.disabled = !!busy;
    els.quickBtn.disabled = !!busy;
    els.pauseBtn.disabled = busy !== 'unfollow';
    els.stopBtn.disabled = !busy;
    els.pauseBtn.textContent = paused ? 'Resume' : 'Pause';

    if (!append) { els.list.replaceChildren(); els.list.scrollTop = 0; }
    if (!S.users.length) {
      els.list.append(h('div', { class: 'empty' }, busy === 'scan' ? 'Scanning…' : '“Quick unfollow N” unfollows up to N non-followers right away, scanning only as far as needed. “Full scan” loads everyone you follow so you can review first.'));
      return;
    }
    if (!list.length) { els.list.replaceChildren(h('div', { class: 'empty' }, filter.view === 'non' ? 'Nobody left — everyone you follow follows you back (or is kept). 🎉' : 'Nothing here.')); return; }
    const start = append ? els.list.querySelectorAll('.u').length : 0;
    const frag = document.createDocumentFragment();
    for (const u of list.slice(start, renderLimit)) frag.append(row(u, ks));
    els.list.append(frag);
  }

  function row(u, ks) {
    const done = !!S.done[u.id];
    const kept = isKept(u, ks);
    return h('div', { class: 'u' + (done ? ' done' : '') + (kept ? ' kept' : ''), 'data-id': u.id },
      h('input', { type: 'checkbox', checked: selected.has(u.id), disabled: done || kept || u.followsYou, 'aria-label': 'Select @' + u.handle }),
      h('img', { src: u.avatar || '', alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }),
      h('div', { class: 'n' },
        h('a', { href: '/' + u.handle, target: '_blank', rel: 'noopener' }, u.name || u.handle, u.verified ? h('span', { class: 'badge', title: 'Verified' }, ' ✓') : null),
        h('small', {}, '@' + u.handle + ' · ' + fmt(u.followers) + ' followers' + (u.protected ? ' · 🔒' : ''))),
      done ? h('span', { class: 'tag x' }, 'unfollowed')
        : u.followsYou ? h('span', { class: 'tag' }, 'follows you')
        : h('button', { class: 'sm', 'data-keep': u.id, title: kept && !ks.has(u.id) ? 'Auto-kept by your settings' : '', disabled: kept && !ks.has(u.id) }, kept ? 'Kept' : 'Keep'));
  }

  function onListChange(e) {
    const r = e.target.closest('.u'); if (!r) return;
    if (e.target.type === 'checkbox') { e.target.checked ? selected.add(r.dataset.id) : selected.delete(r.dataset.id); refreshCounts(); }
  }
  function refreshCounts() { els.st_sel.textContent = fmt(selected.size); els.goBtn.disabled = !!busy || !selected.size; els.goBtn.textContent = selected.size ? `Unfollow ${fmt(selected.size)}` : 'Unfollow'; }

  function onListClick(e) {
    const b = e.target.closest('button[data-keep]'); if (!b) return;
    const id = b.dataset.keep;
    const ks = keepSet();
    if (ks.has(id)) S.keep = S.keep.filter((x) => x !== id);
    else { S.keep.push(id); selected.delete(id); }
    save(); render();
  }

  function selectVisible(on) {
    const ks = keepSet();
    for (const u of visibleUsers()) {
      if (on && !u.followsYou && !S.done[u.id] && !isKept(u, ks)) selected.add(u.id);
      if (!on) selected.delete(u.id);
    }
    render();
  }
  function keepSelected() {
    const ks = keepSet();
    for (const id of selected) if (!ks.has(id)) S.keep.push(id);
    log(`Kept ${selected.size} account(s).`, 'ok');
    selected.clear(); save(); render();
  }
  function exportCsv() {
    const esc = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const rows = [['id', 'handle', 'name', 'followers', 'following', 'follows_you', 'verified', 'kept', 'unfollowed_at']];
    const ks = keepSet();
    for (const u of visibleUsers()) rows.push([u.id, u.handle, u.name, u.followers, u.following, u.followsYou, u.verified, isKept(u, ks), S.done[u.id] ? new Date(S.done[u.id]).toISOString() : '']);
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `x-${filter.view}-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function tick() {
    if (!els.runInfo) return;
    if (waitUntil > Date.now()) els.runInfo.textContent = `${waitReason} — resuming in ${dur(waitUntil - Date.now())}`;
    else if (busy === 'unfollow' && paused) els.runInfo.textContent = 'Paused';
    else if (!busy) els.runInfo.textContent = S.scannedAt ? 'Last scan ' + new Date(S.scannedAt).toLocaleString() : '';
  }

  // Interruptible wait that also honours pause.
  async function wait(ms, reason) {
    waitUntil = Date.now() + ms; waitReason = reason; tick();
    try { await API.sleep(ms, ctrl.signal); } finally { waitUntil = 0; }
    while (paused) await API.sleep(500, ctrl.signal);
  }

  // ---------- actions ----------
  async function scan() {
    if (busy) return;
    busy = 'scan'; ctrl = new AbortController(); render();
    status('Scanning the accounts you follow…');
    progress(0.05);
    const before = S.users.length;
    try {
      await API.loadMeta();
      const users = await API.scanFollowing({
        signal: ctrl.signal,
        onWait: (ms, why) => { waitUntil = Date.now() + ms; waitReason = why; status(`${why} — waiting ${dur(ms)} then continuing…`, 'warn'); log(`${why}; waiting ${dur(ms)}`, 'warn'); },
        onPage: ({ users }) => {
          waitUntil = 0;
          const non = users.filter((u) => !u.followsYou).length;
          status(`Scanning… ${users.length} accounts loaded, ${non} don’t follow you back`);
          progress(before ? Math.min(0.95, users.length / before) : Math.min(0.95, 0.05 + users.length / 3000));
        },
      });
      // Anything previously unfollowed that shows up again was re-followed by you: clear its "done" mark.
      const ids = new Set(users.map((u) => u.id));
      for (const id of Object.keys(S.done)) if (ids.has(id)) delete S.done[id];
      S.users = users; S.scannedAt = Date.now();
      selected = new Set(candidates().map((u) => u.id));
      save();
      const non = users.filter((u) => !u.followsYou).length;
      status(`Done: you follow ${users.length} accounts, ${non} don’t follow you back. ${selected.size} selected for unfollow.`, 'ok');
      log(`Scan complete: ${users.length} following, ${non} not following back.`, 'ok');
      filter.view = 'non';
    } catch (e) {
      if (e.name === 'AbortError') { status('Scan stopped.'); log('Scan stopped by you.'); }
      else { status('Scan failed: ' + e.message, 'err'); log('Scan failed: ' + e.message, 'err'); }
    } finally {
      busy = null; progress(0); render();
    }
  }

  // Candidates from the current selection (after a full scan).
  async function* fromSelection() {
    const ks = keepSet();
    const byId = new Map(S.users.map((u) => [u.id, u]));
    for (const id of [...selected]) {
      const u = byId.get(id);
      if (u && !S.done[u.id] && !u.followsYou && !isKept(u, ks)) yield u;
    }
  }

  // Quick mode: page through Following lazily (newest follows first) and yield
  // non-followers as they're found. Only fetches as many pages as the run needs.
  async function* fromQuickScan() {
    const byId = new Map(S.users.map((u) => [u.id, u]));
    let pages = 0, seen = 0;
    for await (const page of API.followingPages({ signal: ctrl.signal, onWait: onWaitLog })) {
      pages++; seen += page.length;
      for (const u of page) byId.set(u.id, u);
      S.users = [...byId.values()];
      log(`Fetched page ${pages} (${seen} accounts checked).`);
      const ks = keepSet();
      for (const u of page) if (!u.followsYou && !S.done[u.id] && !isKept(u, ks)) yield u;
    }
  }

  function onWaitLog(ms, why) {
    log(`${why}; waiting ${dur(ms)}`, 'warn');
    waitUntil = Date.now() + ms; waitReason = why;
    status(`${why} — waiting ${dur(ms)}…`, 'warn');
  }

  async function runUnfollow({ quick = false } = {}) {
    if (busy) return;
    if (!quick && !selected.size) return;
    const cap = quick ? S.settings.maxPerRun : Math.min(selected.size, S.settings.maxPerRun);
    const today = last24h();
    if (today + cap > 400) log(`Heads-up: ${today} unfollowed in the last 24h. X tends to throttle around a few hundred per day; the run will slow down automatically if that happens.`, 'warn');

    busy = 'unfollow'; paused = false; ctrl = new AbortController(); render();
    let n = 0, soft = 0, fails = 0;
    log(quick ? `Quick unfollow: up to ${cap} non-followers, newest follows first.` : `Starting: ${cap} account(s) to unfollow.`);
    const source = quick ? fromQuickScan() : fromSelection();
    try {
      for await (const u of source) {
        if (n >= cap) break;
        let ok = false, rate;
        // Inner loop only repeats when X silently ignored the unfollow (soft throttle).
        for (;;) {
          while (paused) await API.sleep(500, ctrl.signal);
          status(`Unfollowing @${u.handle} (${n + 1}/${cap})…`);
          try {
            ({ rate } = await API.withRetry(() => API.unfollow(u.id), { signal: ctrl.signal, tries: 4, onWait: onWaitLog }));
            fails = 0;
          } catch (e) {
            if (e.name === 'AbortError' || e.fatal) throw e;
            // 404/403 on a single user (deleted, suspended…) shouldn't kill the run.
            log(`Skipped @${u.handle}: ${e.message}`, 'err');
            if (++fails >= 5) throw new Error('5 failures in a row — stopping to protect your account.');
            break;
          }
          // Every N, check X really applied it — silent no-ops are the classic sign of a soft throttle.
          if (S.settings.verifyEvery && (n + 1) % S.settings.verifyEvery === 0) {
            const still = await API.withRetry(() => API.isFollowing(u.id), { signal: ctrl.signal, tries: 3 }).catch(() => false);
            if (still) {
              if (++soft >= 3) throw new Error('X keeps silently ignoring unfollows (soft limit). Stopping — try again in a few hours.');
              log(`X silently ignored the unfollow of @${u.handle} — you're being throttled. Cooling down.`, 'warn');
              await wait(15 * 60e3 * soft, 'X is throttling silently');
              continue; // retry same user
            }
            soft = 0;
          }
          ok = true;
          break;
        }
        if (!ok) continue;
        n++;
        S.done[u.id] = Date.now();
        S.history.push(Date.now());
        S.history = S.history.filter((t) => t > Date.now() - 7 * 864e5);
        selected.delete(u.id);
        save();
        log(`Unfollowed @${u.handle}`, 'ok');
        progress(n / cap);
        els.st_sel.textContent = fmt(selected.size); els.st_day.textContent = fmt(last24h());
        els.list.querySelector(`.u[data-id="${u.id}"]`)?.remove();
        if (n >= cap) break;

        if (rate && rate.remaining <= 1 && rate.resetAt > Date.now()) {
          await wait(rate.resetAt - Date.now() + 3000, 'Unfollow rate limit reached');
        } else if (S.settings.pauseEvery && n % S.settings.pauseEvery === 0 && S.settings.pauseMinutes) {
          log(`Taking a ${S.settings.pauseMinutes} min break after ${n} unfollows.`);
          await wait(S.settings.pauseMinutes * 60e3, 'Scheduled break');
        } else {
          const lo = S.settings.minDelay, hi = Math.max(lo, S.settings.maxDelay);
          await wait((lo + Math.random() * (hi - lo)) * 1000, 'Pacing');
        }
      }
      status(`Finished: unfollowed ${n} account(s).`, 'ok');
      log(`Run finished: ${n} unfollowed.`, 'ok');
    } catch (e) {
      if (e.name === 'AbortError') { status(`Stopped after ${n} unfollow(s).`); log(`Stopped by you after ${n}.`); }
      else { status(`Stopped after ${n}: ${e.message}`, 'err'); log(e.message, 'err'); }
    } finally {
      source.return?.();
      busy = null; paused = false; waitUntil = 0; progress(0); save(); render();
    }
  }

  function togglePause() { paused = !paused; log(paused ? 'Paused.' : 'Resumed.'); render(); refreshCounts(); }
  function stop() { ctrl?.abort(); paused = false; }

  // ---------- open / close ----------
  async function toggle(force) {
    try {
      if (!S) { await load(); selected = new Set(candidates().map((u) => u.id)); }
    } catch (e) {
      console.warn('[XMU]', e.message);
      return;
    }
    let show = force ?? (host ? host.style.display === 'none' : true);
    if (!host) { build(); els.list.addEventListener('click', onListClick); render(); }
    host.style.display = show ? '' : 'none';
  }

  window.__XMU = { toggle, state: () => S };

  if (location.hash === '#xmu') {
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => toggle(true), 800);
  }
})();
