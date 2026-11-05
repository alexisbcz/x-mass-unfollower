import { useState, useSyncExternalStore, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ThemeProvider } from "twenty-ui/theme";
import { ListItem } from "twenty-ui/primitives/navigation";
import { Text } from "twenty-ui/primitives/typography";
import { LightIconButton, MainButton } from "twenty-ui/components/input";
import {
  IconApi,
  IconAppWindow,
  IconBrandGithub,
  IconDownload,
  IconExternalLink,
  IconHelpCircle,
  IconHome,
  IconLayoutSidebarLeftExpand,
  IconMoon,
  IconPuzzle,
  IconSun,
} from "twenty-ui/icon";
import { Gloss, REPO, ZIP, type IconComp } from "./ui";

// ---------------------------------------------------------------------------------------------
// Color scheme: follows the OS until the visitor picks one, then remembers it.

const KEY = "xmu-site-theme";
const EVENT = "xmu:theme";
type Scheme = "light" | "dark";
const readScheme = (): Scheme => {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "dark" || s === "light") return s;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const setScheme = (s: Scheme) => {
  try {
    localStorage.setItem(KEY, s);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
};

// ---------------------------------------------------------------------------------------------

export const NAV: { to: string; label: string; icon: IconComp; hue: number }[] = [
  { to: "/", label: "Overview", icon: IconHome, hue: 215 },
  { to: "/install", label: "Install", icon: IconPuzzle, hue: 145 },
  { to: "/how-it-works", label: "How it works", icon: IconApi, hue: 262 },
  { to: "/panel", label: "Panel preview", icon: IconAppWindow, hue: 28 },
  { to: "/faq", label: "FAQ & safety", icon: IconHelpCircle, hue: 330 },
];

function Drawer({ onNavigate }: { onNavigate: () => void }) {
  const scheme = useSyncExternalStore(subscribe, readScheme);
  const { pathname } = useLocation();
  return (
    <nav aria-label="Main" className="tw-drawer">
      <div className="tw-workspace">
        <img className="tw-workspace-logo" src={`${import.meta.env.BASE_URL}icon.png`} alt="" />
        <span className="tw-workspace-name">X Mass Unfollower</span>
        <LightIconButton
          aria-label={scheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          tooltip={scheme === "dark" ? "Light theme" : "Dark theme"}
          emphasis="subtle"
          size="sm"
          onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}
        >
          {scheme === "dark" ? <IconSun /> : <IconMoon />}
        </LightIconButton>
      </div>
      <div className="tw-drawer-group">
        <div className="tw-drawer-label">Guide</div>
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <ListItem
              key={item.to}
              active={active}
              startIcon={<Gloss icon={item.icon} hue={item.hue} />}
              render={<NavLink to={item.to} onClick={onNavigate} />}
            >
              {item.label}
            </ListItem>
          );
        })}
      </div>
      <div className="tw-drawer-group">
        <div className="tw-drawer-label">Source</div>
        <ListItem startIcon={<IconBrandGithub />} endIcon={<IconExternalLink />} render={<a href={REPO} target="_blank" rel="noreferrer" />}>
          GitHub repository
        </ListItem>
      </div>
      <div className="tw-drawer-foot">
        <MainButton size="sm" fullWidth startIcon={<IconDownload />} render={<a href={ZIP} />} nativeButton={false} style={{ marginBottom: 8 }}>
          Download ZIP
        </MainButton>
        <Text size="xs" color="tertiary">
          Open source, MIT licensed. Runs entirely in your browser.
        </Text>
      </div>
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const scheme = useSyncExternalStore(subscribe, readScheme);
  const [drawer, setDrawer] = useState(false);
  return (
    <ThemeProvider colorScheme={scheme}>
      <div className="tw-app" data-drawer={drawer || undefined}>
        <div className="tw-drawer-wrap">
          <Drawer onNavigate={() => setDrawer(false)} />
        </div>
        <button type="button" aria-hidden="true" tabIndex={-1} className="tw-scrim" onClick={() => setDrawer(false)} />
        <div className="tw-main">
          <div className="tw-mobilebar">
            <LightIconButton aria-label="Open navigation" size="md" onClick={() => setDrawer(true)}>
              <IconLayoutSidebarLeftExpand />
            </LightIconButton>
            <span className="tw-workspace-name">X Mass Unfollower</span>
          </div>
          {children}
        </div>
      </div>
    </ThemeProvider>
  );
}
