import { Link } from "react-router-dom";
import { Callout } from "twenty-ui/components/feedback";
import { LightButton, MainButton } from "twenty-ui/components/input";
import { Tag } from "twenty-ui/primitives/data-display";
import {
  IconApi,
  IconBolt,
  IconBrandGithub,
  IconClock,
  IconDatabase,
  IconDownload,
  IconEyeOff,
  IconHome,
  IconRefresh,
  IconShield,
} from "twenty-ui/icon";
import { Gloss, PageHead, Panel, REPO, ZIP, type IconComp } from "../ui";

const FEATURES: { icon: IconComp; hue: number; title: string; body: string }[] = [
  {
    icon: IconApi,
    hue: 262,
    title: "X's own web API, not the DOM",
    body: "Reads your Following list through the same GraphQL endpoint x.com uses, so a renamed button or a new dialog can't break it.",
  },
  {
    icon: IconRefresh,
    hue: 200,
    title: "Survives X redeploys",
    body: "GraphQL query IDs and feature flags are read from X's current JS bundle at runtime, and missing flags are added automatically.",
  },
  {
    icon: IconClock,
    hue: 38,
    title: "Paced like a human",
    body: "Random 3 to 7 s delays, a 3 min break every 50 unfollows and a 400 per run cap by default. All adjustable.",
  },
  {
    icon: IconShield,
    hue: 145,
    title: "Stops before X does",
    body: "Waits out rate limits, detects silent throttling, and stops hard on account lock, daily limit or auth errors.",
  },
  {
    icon: IconBolt,
    hue: 10,
    title: "Quick unfollow",
    body: "Unfollow the newest N non-followers without scanning everything: it only pages as far as it needs to.",
  },
  {
    icon: IconDatabase,
    hue: 185,
    title: "Resumable, large-account ready",
    body: "Scan results, kept accounts and history live in IndexedDB on x.com. 20k+ following works fine.",
  },
];

export function Overview() {
  return (
    <>
      <PageHead
        icon={IconHome}
        hue={215}
        title="Overview"
        actions={
          <LightButton startIcon={<IconBrandGithub />} render={<a href={REPO} target="_blank" rel="noreferrer" />} nativeButton={false}>
            GitHub
          </LightButton>
        }
      />
      <Panel>
        <div className="tw-doc">
          <div className="tw-hero">
            <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" />
            <div>
              <h1>X Mass Unfollower</h1>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <Tag color="blue">Chrome MV3</Tag>
                <Tag color="green">Open source · MIT</Tag>
                <Tag color="purple">No servers</Tag>
                <Tag color="gray">v1.0.0</Tag>
              </div>
            </div>
          </div>
          <p className="tw-lead">
            A browser extension that finds the X (Twitter) accounts you follow that don't follow you back, and unfollows them at a safe pace. It talks to
            X's internal web API from your own logged-in tab, exactly like x.com does.
          </p>
          <div className="tw-actions">
            <MainButton startIcon={<IconDownload />} render={<a href={ZIP} />} nativeButton={false}>
              Download ZIP
            </MainButton>
            <LightButton render={<Link to="/install" />} nativeButton={false}>
              Install guide
            </LightButton>
            <LightButton render={<Link to="/how-it-works" />} nativeButton={false}>
              How it works
            </LightButton>
          </div>

          <h2>What it does</h2>
          <div className="tw-grid">
            {FEATURES.map((f) => (
              <div className="tw-feature" key={f.title}>
                <div className="tw-feature-head">
                  <Gloss icon={f.icon} hue={f.hue} size="md" />
                  {f.title}
                </div>
                <p>{f.body}</p>
              </div>
            ))}
          </div>

          <h2>Privacy</h2>
          <Callout
            status="success"
            icon={<IconEyeOff />}
            title="Nothing leaves your browser"
            description="The extension has no backend, no analytics and no third-party requests. Every call goes from your x.com tab to x.com itself, with the session you're already logged in with. Your data is stored in your browser's IndexedDB for x.com and nowhere else."
          />
          <p>
            Permissions are kept to the minimum: <code>scripting</code> (to toggle the panel when you click the toolbar icon) and host access to{" "}
            <code>x.com</code> and <code>twitter.com</code>. The full source is a few hundred lines of plain JavaScript you can read in one sitting.
          </p>

          <h2>Two ways to work</h2>
          <ul>
            <li>
              <strong>Quick unfollow.</strong> Type a number and go. It pages through your Following list newest-first and unfollows non-followers as it
              finds them, skipping anyone you marked Keep.
            </li>
            <li>
              <strong>Full scan, then review.</strong> Load everyone you follow, filter and sort the non-followers, keep the ones you care about, export a
              CSV, then unfollow the selection with pause, resume and stop.
            </li>
          </ul>

          <Callout
            status="warning"
            title="Unofficial tool"
            description="This project is not affiliated with X Corp. It uses X's private web API, which may go against X's Terms of Service. Mass-unfollowing can trigger rate limits or account restrictions. Use it at your own risk."
          />
        </div>
      </Panel>
    </>
  );
}
