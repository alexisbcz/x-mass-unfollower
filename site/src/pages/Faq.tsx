import type { ReactNode } from "react";
import { Callout } from "twenty-ui/components/feedback";
import { IconAlertTriangle, IconChevronRight, IconHelpCircle } from "twenty-ui/icon";
import { PageHead, Panel, REPO } from "../ui";

const QA: { q: string; a: ReactNode }[] = [
  {
    q: "Can this get my account restricted?",
    a: (
      <>
        <p>
          Yes, it can. Mass-unfollowing is exactly what X's anti-spam systems watch for. The extension paces itself, checks that unfollows really apply,
          and stops on lock, daily-limit or auth errors, but no tool can promise X won't act on your account.
        </p>
        <p>
          X's documented unfollow limit is around 187 per 15 minutes, and the undocumented daily limits are lower. For a big cleanup, spread it over a few
          days and keep it under about 400 a day.
        </p>
      </>
    ),
  },
  {
    q: "Is it against X's Terms of Service?",
    a: (
      <p>
        It may be. The extension uses X's private web API, the same endpoints x.com calls, with your own session. X doesn't publish these endpoints for
        third-party use and its terms restrict automated access. Read X's terms and decide for yourself. You're responsible for how you use it.
      </p>
    ),
  },
  {
    q: "Does it send my data anywhere?",
    a: (
      <p>
        No. There's no backend, analytics or telemetry. The only requests go from your x.com tab to x.com (and to X's own JS bundle on its CDN to read
        query IDs). Scan results and settings stay in your browser's IndexedDB for x.com. Your session cookies are used by the browser as usual and are
        never read into storage or sent elsewhere.
      </p>
    ),
  },
  {
    q: "Why does it need the scripting permission?",
    a: (
      <p>
        Clicking the toolbar icon runs one function in your x.com tab to show or hide the panel. That's all it's used for. Host access is limited to
        x.com and twitter.com.
      </p>
    ),
  },
  {
    q: "What does \"X is throttling silently\" mean?",
    a: (
      <p>
        X sometimes answers an unfollow with 200 OK but doesn't apply it. The extension spots this by re-checking the relationship every 10 unfollows.
        When it happens, it waits 15 minutes (30 the second time) and retries. A third occurrence stops the run: try again in a few hours.
      </p>
    ),
  },
  {
    q: "I closed the tab mid-run. Did I lose progress?",
    a: (
      <p>
        No. Every unfollow is saved as it happens. Open the panel again and the Unfollowed tab, kept accounts and remaining selection are still there.
        Press Unfollow to continue.
      </p>
    ),
  },
  {
    q: "How do I protect accounts I never want to unfollow?",
    a: (
      <p>
        Mark them Keep, one by one or with Keep selected. Kept accounts are skipped by both Quick unfollow and the full flow. You can also auto-keep
        verified accounts or accounts above a follower count in the settings.
      </p>
    ),
  },
  {
    q: "It stopped working after an X update. What now?",
    a: (
      <p>
        Query IDs and feature flags repair themselves, so most X deploys are handled. If X changes a response shape or an endpoint, please{" "}
        <a className="tw-link" href={`${REPO}/issues`} target="_blank" rel="noreferrer">
          open an issue
        </a>{" "}
        with the error from the panel's activity log.
      </p>
    ),
  },
];

export function Faq() {
  return (
    <>
      <PageHead icon={IconHelpCircle} hue={330} title="FAQ & safety" />
      <Panel>
        <div className="tw-doc">
          <Callout
            status="warning"
            icon={<IconAlertTriangle />}
            title="Use at your own risk"
            description="This is an unofficial tool, not affiliated with or endorsed by X Corp. It relies on X's private web API, which can change at any time and whose use may violate X's Terms of Service. Mass-unfollowing can lead to rate limits, temporary locks or other account restrictions. You alone are responsible for how you use it."
          />
          <div className="tw-faq">
            {QA.map((x, i) => (
              <details key={x.q} open={i === 0}>
                <summary>
                  <IconChevronRight size={16} aria-hidden />
                  {x.q}
                </summary>
                <div className="tw-faq-body">{x.a}</div>
              </details>
            ))}
          </div>
        </div>
      </Panel>
    </>
  );
}
