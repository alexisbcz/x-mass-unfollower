import { useState } from "react";
import { Callout } from "twenty-ui/components/feedback";
import { LightButton, MainButton } from "twenty-ui/components/input";
import { Avatar, Tag } from "twenty-ui/primitives/data-display";
import { Checkbox } from "twenty-ui/primitives/input";
import { Tabs } from "twenty-ui/primitives/navigation";
import { ProgressBar } from "twenty-ui/primitives/feedback";
import {
  IconAppWindow,
  IconAt,
  IconCalendar,
  IconCheck,
  IconFileExport,
  IconInfoCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconUser,
  IconUsers,
} from "twenty-ui/icon";
import { PageHead, Panel } from "../ui";

// A static, illustrative mock of the extension's in-page panel. All accounts are fictional.

type Account = { id: string; name: string; handle: string; followers: number; followed: string; verified?: boolean; kept?: boolean };
const ACCOUNTS: Account[] = [
  { id: "1", name: "Nordic Pixel Studio", handle: "nordicpixel", followers: 1840, followed: "2026-10-28" },
  { id: "2", name: "Ada Fernwood", handle: "adafernwood", followers: 312, followed: "2026-10-14" },
  { id: "3", name: "Daily Rust Tips", handle: "dailyrusttips", followers: 22400, followed: "2026-09-30", verified: true, kept: true },
  { id: "4", name: "Marco Bellweather", handle: "mbellweather", followers: 96, followed: "2026-09-02" },
  { id: "5", name: "Open Data Weekly", handle: "opendataweekly", followers: 5310, followed: "2026-08-19" },
  { id: "6", name: "Lena Okafor", handle: "lenaokafor_dev", followers: 2770, followed: "2026-07-07" },
  { id: "7", name: "Synthwave Daily", handle: "synthwavedaily", followers: 40100, followed: "2026-05-23", verified: true },
  { id: "8", name: "Tomás Reyes", handle: "tomreyes", followers: 154, followed: "2026-03-11" },
];

const LOG: { t: string; kind?: "ok" | "warn"; msg: string }[] = [
  { t: "14:32:08", kind: "ok", msg: "Unfollowed @quietharbor" },
  { t: "14:32:03", kind: "ok", msg: "Unfollowed @pixelfjord" },
  { t: "14:31:57", msg: "Fetched page 2 (200 accounts checked)." },
  { t: "14:29:41", kind: "warn", msg: "Taking a 3 min break after 50 unfollows." },
  { t: "14:24:12", msg: "Quick unfollow: up to 100 non-followers, newest follows first." },
];

const fmt = (n: number) => (n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

export function PanelPreview() {
  const [tab, setTab] = useState("non");
  const [sel, setSel] = useState(() => new Set(ACCOUNTS.filter((a) => !a.kept).map((a) => a.id)));
  const toggle = (id: string, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <>
      <PageHead icon={IconAppWindow} hue={28} title="Panel preview" />
      <Panel>
        <div style={{ padding: "12px 16px 0" }}>
          <Callout
            status="neutral"
            icon={<IconInfoCircle />}
            title="Illustrative mock"
            description="A static re-creation of the panel the extension draws on x.com, with fictional accounts. The real panel runs in a shadow DOM inside your X tab."
          />
        </div>
        <div className="tw-mock" style={{ marginTop: 12, borderTop: "1px solid var(--t-border-color-light)" }}>
          {[
            ["4,212", "Following"],
            ["1,067", "Not following back"],
            [String(sel.size), "Selected"],
            ["58", "Unfollowed 24h"],
          ].map(([v, l]) => (
            <div className="tw-mock-stat" key={l}>
              <b className="tw-num">{v}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid var(--t-border-color-light)" }}>
          <span style={{ color: "var(--t-font-color-secondary)" }}>Unfollowing @tomreyes (59/100)…</span>
          <ProgressBar value={59} aria-label="Run progress" />
        </div>
        <div className="tw-mock-tabs">
          <Tabs.Root value={tab} onValueChange={(v) => setTab(String(v))}>
            <Tabs.List aria-label="Lists">
              <Tabs.Tab value="non">Not following back</Tabs.Tab>
              <Tabs.Tab value="kept">Kept</Tabs.Tab>
              <Tabs.Tab value="done">Unfollowed</Tabs.Tab>
              <Tabs.Tab value="all">All</Tabs.Tab>
              <Tabs.Indicator />
            </Tabs.List>
          </Tabs.Root>
        </div>
        <div className="tw-viewbar">
          <div className="tw-viewbar-name">
            <IconUsers size={16} aria-hidden style={{ color: "var(--t-font-color-tertiary)" }} />
            Not following back
            <span className="tw-viewbar-count tw-num">· {ACCOUNTS.length}</span>
          </div>
          <div className="tw-viewbar-spacer" />
          <LightButton startIcon={<IconCheck />}>Keep selected</LightButton>
          <LightButton startIcon={<IconFileExport />}>Export CSV</LightButton>
        </div>
        <div style={{ overflow: "auto" }}>
          <table className="tw-table" aria-label="Accounts">
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 240 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th aria-label="Select" />
                {[
                  [IconUser, "Name"],
                  [IconAt, "Handle"],
                  [IconUsers, "Followers"],
                  [IconCalendar, "Followed"],
                  [IconCheck, "Status"],
                ].map(([I, l]) => {
                  const Icon = I as typeof IconUser;
                  return (
                    <th key={l as string}>
                      <span className="tw-th">
                        <Icon size={16} stroke={1.6} aria-hidden />
                        {l as string}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.map((a) => (
                <tr key={a.id}>
                  <td style={{ textAlign: "center" }}>
                    <Checkbox checked={sel.has(a.id)} disabled={a.kept} onCheckedChange={(on) => toggle(a.id, on)} aria-label={`Select @${a.handle}`} />
                  </td>
                  <td>
                    <span className="tw-cell-row">
                      <Avatar name={a.name} colorSeed={a.handle} shape="circle" size="md" />
                      {a.name}
                      {a.verified && <Tag color="blue">Verified</Tag>}
                    </span>
                  </td>
                  <td className="tw-cell-muted">@{a.handle}</td>
                  <td className="tw-num">{fmt(a.followers)}</td>
                  <td className="tw-num tw-cell-muted">{a.followed}</td>
                  <td>{a.kept ? <Tag color="green">Kept</Tag> : <Tag color="gray">Not following back</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tw-mock-foot">
          <span style={{ flex: 1, color: "var(--t-font-color-tertiary)" }}>Pacing — resuming in 4s</span>
          <LightButton startIcon={<IconPlayerPause />}>Pause</LightButton>
          <LightButton startIcon={<IconPlayerStop />}>Stop</LightButton>
          <MainButton color="danger" startIcon={<IconPlayerPlay />}>
            Unfollow {sel.size}
          </MainButton>
        </div>
        <div className="tw-mock-log" aria-label="Activity log">
          {LOG.map((l) => (
            <div key={l.t} data-kind={l.kind}>
              {l.t}  {l.msg}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
