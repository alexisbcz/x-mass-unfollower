import { Callout } from "twenty-ui/components/feedback";
import { Tag, Status } from "twenty-ui/primitives/data-display";
import type { TagColor } from "twenty-ui/primitives/data-display";
import {
  IconAlertTriangle,
  IconApi,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconFileText,
  IconHash,
  IconInfoCircle,
  IconKey,
  IconLink,
  IconListDetails,
  IconRefresh,
  IconSettings,
} from "twenty-ui/icon";
import { PageHead, Panel, RecordTable, type Column } from "../ui";

// Everything below mirrors extension/src/api.js and extension/src/ui.js.

type Endpoint = { method: "GET" | "POST"; path: string; op: string; purpose: string };
const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/i/api/graphql/{queryId}/Following", op: "Following", purpose: "Page through who you follow (count 100 per request). Each user carries relationship_perspectives.followed_by." },
  { method: "POST", path: "/i/api/1.1/friendships/destroy.json", op: "Unfollow", purpose: "Form-encoded user_id. Returns rate-limit headers used for pacing." },
  { method: "GET", path: "/i/api/1.1/friendships/show.json", op: "Verify", purpose: "source_id + target_id. Ground truth for whether an unfollow really applied." },
  { method: "GET", path: "client-web/main.<hash>.js", op: "Discovery", purpose: "X's own JS bundle, fetched to read current query IDs, feature switches, field toggles and the web bearer token." },
];

const methodColor = (m: Endpoint["method"]): TagColor => (m === "GET" ? "blue" : "orange");
const ENDPOINT_COLS: Column<Endpoint>[] = [
  { id: "op", label: "Operation", icon: IconApi, width: 120, render: (r) => <b style={{ fontWeight: 500 }}>{r.op}</b> },
  { id: "method", label: "Method", icon: IconSettings, width: 90, render: (r) => <Tag color={methodColor(r.method)}>{r.method}</Tag> },
  { id: "path", label: "Path", icon: IconLink, width: 300, render: (r) => <code>{r.path}</code> },
  { id: "purpose", label: "Purpose", icon: IconFileText, width: 380, wrap: true, render: (r) => r.purpose },
];

type Header = { name: string; source: string; note: string };
const HEADERS: Header[] = [
  { name: "authorization", source: "Bundle", note: "Bearer + the public web-app token (same for every user), read from the bundle with a hard-coded fallback." },
  { name: "x-csrf-token", source: "Cookie", note: "Value of the ct0 cookie, read at request time. Never stored." },
  { name: "x-twitter-auth-type", source: "Constant", note: "OAuth2Session, as sent by x.com." },
  { name: "x-twitter-active-user", source: "Constant", note: "yes" },
  { name: "x-twitter-client-language", source: "Page", note: "The page's <html lang>, defaulting to en." },
  { name: "cookies", source: "Browser", note: "credentials: 'include' on same-origin fetch. The viewer id comes from the twid cookie." },
];
const SOURCE_COLOR: Record<string, TagColor> = { Bundle: "purple", Cookie: "amber", Constant: "gray", Page: "sky", Browser: "green" };
const HEADER_COLS: Column<Header>[] = [
  { id: "name", label: "Header", icon: IconKey, width: 210, render: (r) => <code>{r.name}</code> },
  { id: "source", label: "Source", icon: IconListDetails, width: 110, render: (r) => <Tag color={SOURCE_COLOR[r.source]}>{r.source}</Tag> },
  { id: "note", label: "Notes", icon: IconFileText, width: 440, wrap: true, render: (r) => r.note },
];

type Outcome = "wait" | "retry" | "stop" | "skip" | "cooldown";
type Rule = { trigger: string; meaning: string; outcome: Outcome; action: string };
const RULES: Rule[] = [
  { trigger: "HTTP 429 · code 88", meaning: "Rate limited", outcome: "wait", action: "Sleep until x-rate-limit-reset + 3 s (15 min if the header is missing). Doesn't count as a failed attempt." },
  { trigger: "x-rate-limit-remaining ≤ 1", meaning: "Window almost spent", outcome: "wait", action: "After a successful unfollow, wait for the reset instead of hitting the limit." },
  { trigger: "HTTP 400 · features cannot be null", meaning: "New feature flag", outcome: "retry", action: "Parse the flag names from the error, add them as false, retry (up to 2 times)." },
  { trigger: "HTTP 400 / 404 (GraphQL)", meaning: "Stale query ID", outcome: "retry", action: "Re-download X's bundle, rediscover query IDs, retry." },
  { trigger: "200 OK but still following", meaning: "Silent throttle", outcome: "cooldown", action: "Cool down 15 min × strike, retry the same account. Third strike stops the run." },
  { trigger: "code 326", meaning: "Account locked", outcome: "stop", action: "Hard stop. Nothing else is sent." },
  { trigger: "code 344", meaning: "Daily limit reached", outcome: "stop", action: "Hard stop. Try again tomorrow." },
  { trigger: "code 64", meaning: "Account suspended", outcome: "stop", action: "Hard stop." },
  { trigger: "code 32 / 215 · HTTP 401", meaning: "Bad authentication", outcome: "stop", action: "Hard stop: you're logged out or the session expired." },
  { trigger: "Other error on one account", meaning: "Deleted, suspended…", outcome: "skip", action: "Log and skip that account. 5 failures in a row stops the run." },
  { trigger: "Other transient error", meaning: "Network, 5xx", outcome: "retry", action: "Exponential backoff from 15 s, doubling up to 10 min." },
];
const OUTCOME: Record<Outcome, { label: string; color: Exclude<TagColor, "transparent"> }> = {
  wait: { label: "Wait", color: "amber" },
  retry: { label: "Self-repair", color: "blue" },
  cooldown: { label: "Cool down", color: "orange" },
  skip: { label: "Skip", color: "gray" },
  stop: { label: "Hard stop", color: "red" },
};
const RULE_COLS: Column<Rule>[] = [
  { id: "trigger", label: "Signal", icon: IconHash, width: 230, render: (r) => <code>{r.trigger}</code> },
  { id: "meaning", label: "Meaning", icon: IconInfoCircle, width: 170, render: (r) => r.meaning },
  {
    id: "outcome",
    label: "Response",
    icon: IconAlertTriangle,
    width: 130,
    render: (r) => (
      <Status color={OUTCOME[r.outcome].color}>{OUTCOME[r.outcome].label}</Status>
    ),
  },
  { id: "action", label: "What the extension does", icon: IconCheck, width: 420, wrap: true, render: (r) => r.action },
];

type Pace = { setting: string; value: string; note: string };
const PACING: Pace[] = [
  { setting: "Delay between unfollows", value: "3–7 s", note: "Uniformly random." },
  { setting: "Scheduled break", value: "3 min / 50", note: "A pause every 50 unfollows." },
  { setting: "Max per run", value: "400", note: "Also the Quick unfollow count. A warning is logged if the last 24 h plus this run exceed 400." },
  { setting: "Verify every", value: "10", note: "Checks friendships/show to catch silent throttling. 0 turns it off." },
  { setting: "Page jitter (scan)", value: "0.4–1 s", note: "Between Following pages." },
  { setting: "Auto-keep", value: "Off", note: "Optionally keep verified accounts or accounts with ≥ N followers." },
];
const PACE_COLS: Column<Pace>[] = [
  { id: "setting", label: "Setting", icon: IconSettings, width: 200, render: (r) => r.setting },
  { id: "value", label: "Default", icon: IconClock, width: 110, render: (r) => <Tag color="gray">{r.value}</Tag> },
  { id: "note", label: "Notes", icon: IconFileText, width: 420, wrap: true, render: (r) => r.note },
];

const DISCOVERY = String.raw`// extension/src/api.js, loadMeta()
const src = [...document.scripts].map((s) => s.src)
  .find((s) => /\/client-web[^/]*\/main\.[\w]+\.js/.test(s));
const js = await (await fetch(src)).text();
const b = js.match(/"(AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]+)"/);
if (b) bearer = b[1];
const m = js.match(new RegExp(
  'queryId:"([^"]+)",operationName:"' + op + '",operationType:"\\w+",' +
  'metadata:\\{featureSwitches:\\[([^\\]]*)\\],fieldToggles:\\[([^\\]]*)\\]'));
if (m) ops[op] = { id: m[1],
  features: JSON.parse('[' + m[2] + ']'),
  toggles: JSON.parse('[' + m[3] + ']') };`;

export function HowItWorks() {
  return (
    <>
      <PageHead icon={IconApi} hue={262} title="How it works" />
      <Panel>
        <div className="tw-doc">
          <h2>Architecture</h2>
          <p>
            Most unfollow tools scroll <code>x.com/following</code> and click buttons. They break whenever X renames a <code>data-testid</code> or adds a
            dialog. This extension was built by watching x.com's own network traffic in DevTools and replaying the same requests, so it never touches X's
            markup.
          </p>
          <div className="tw-flow" aria-label="Request flow">
            <div className="tw-flow-node">
              <b>Toolbar click</b>
              <span>background.js service worker runs a function in the tab's MAIN world</span>
            </div>
            <div className="tw-flow-arrow"><IconArrowRight size={16} /></div>
            <div className="tw-flow-node">
              <b>Panel (ui.js)</b>
              <span>Shadow-DOM panel and run engine, injected at document_idle</span>
            </div>
            <div className="tw-flow-arrow"><IconArrowRight size={16} /></div>
            <div className="tw-flow-node">
              <b>API client (api.js)</b>
              <span>Discovery, retries, rate limits. Same-origin fetch with your cookies</span>
            </div>
            <div className="tw-flow-arrow"><IconArrowRight size={16} /></div>
            <div className="tw-flow-node">
              <b>x.com /i/api</b>
              <span>GraphQL and REST 1.1 endpoints used by the web app</span>
            </div>
          </div>
          <p>
            Running in the page's MAIN world means requests are same-origin: the browser attaches your session cookies, and there are no CORS or token
            hand-off problems. The only permissions are <code>scripting</code> and host access to x.com and twitter.com.
          </p>

          <h2>Endpoints</h2>
          <RecordTable label="Endpoints" rows={ENDPOINTS} columns={ENDPOINT_COLS} rowKey={(r) => r.op} />

          <h2>Request headers</h2>
          <p>Each request carries the same headers the web app sends. Nothing is hard-coded per user.</p>
          <RecordTable label="Request headers" rows={HEADERS} columns={HEADER_COLS} rowKey={(r) => r.name} />

          <h2>Query-ID discovery</h2>
          <p>
            X's GraphQL operations are addressed by a query ID that changes when X redeploys. Instead of shipping a stale ID, the extension finds the
            current <code>main.*.js</code> bundle on the page and extracts the ID, its feature switches and its field toggles with a regex. A last-known ID
            and bearer token remain as fallbacks if discovery fails.
          </p>
          <pre className="tw-code">
            <code>{DISCOVERY}</code>
          </pre>

          <h2>Feature-flag self-repair</h2>
          <p>
            GraphQL requests must send every feature flag the server expects. When X adds one, it answers <code>400</code> with{" "}
            <code>features cannot be null: flag_a, flag_b</code>. The client parses those names, adds them as <code>false</code> for the rest of the session,
            and retries. Any other 400 or a 404 triggers a fresh bundle download and query-ID rediscovery. Each request gets at most two repairs.
          </p>

          <h2>Pagination</h2>
          <p>
            <code>Following</code> is walked with <code>cursor-bottom</code> entries, as an async generator. A full scan consumes every page; Quick unfollow
            pulls pages only while it still needs candidates, so unfollowing 100 accounts costs a handful of requests. Users are normalised from both the
            older <code>legacy</code> schema and the newer split one (<code>core</code>, <code>relationship_perspectives</code>,{" "}
            <code>relationship_counts</code>). Paging stops on a missing, repeated or terminal (<code>0|…</code>) cursor, or after two empty pages.
          </p>

          <h2>Errors, rate limits and hard stops</h2>
          <RecordTable label="Error handling" rows={RULES} columns={RULE_COLS} rowKey={(r) => r.trigger} />

          <h2>Silent-throttle detection</h2>
          <p>
            When X throttles an account, <code>friendships/destroy</code> can return <code>200 OK</code> without unfollowing anyone. A tool that trusts the
            status code keeps going and burns your daily budget for nothing. Every 10th unfollow (configurable), the extension asks{" "}
            <code>friendships/show</code> whether you still follow that account. If you do, it logs a strike, cools down for 15 minutes (30 on the second
            strike) and retries the same account. On the third strike it stops the run.
          </p>

          <h2>Pacing defaults</h2>
          <RecordTable label="Pacing defaults" rows={PACING} columns={PACE_COLS} rowKey={(r) => r.setting} />

          <h2>State</h2>
          <p>
            Everything is stored per X account in IndexedDB on x.com (database <code>xmu</code>, key <code>v1:&lt;your user id&gt;</code>): the last scan,
            kept accounts, unfollowed accounts, a 7-day history used for the 24 h counter, and your settings. IndexedDB is used instead of localStorage
            because a 20k-account scan is several megabytes. Writes are coalesced so a fast run never queues hundreds of saves.
          </p>

          <Callout
            status="info"
            icon={<IconRefresh />}
            title="Why this matters"
            description="Discovery, self-repair and throttle detection are what keep an integration against a private API working for months instead of days. The same approach applies to any web app without a public API: capture HAR traffic, identify the stable contract, and make the client adapt to the parts that change."
          />
        </div>
      </Panel>
    </>
  );
}

