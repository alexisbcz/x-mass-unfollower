import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "twenty-ui/style.css";
import "twenty-ui/theme-light.css";
import "twenty-ui/theme-dark.css";
import "./site.css";
import { Shell } from "./shell";
import { Overview } from "./pages/Overview";
import { Install } from "./pages/Install";
import { HowItWorks } from "./pages/HowItWorks";
import { PanelPreview } from "./pages/PanelPreview";
import { Faq } from "./pages/Faq";

const TITLES: Record<string, string> = {
  "/": "X Mass Unfollower",
  "/install": "Install · X Mass Unfollower",
  "/how-it-works": "How it works · X Mass Unfollower",
  "/panel": "Panel preview · X Mass Unfollower",
  "/faq": "FAQ & safety · X Mass Unfollower",
};

function Title() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? TITLES["/"];
    document.querySelector(".tw-scroll")?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Title />
      <Shell>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/install" element={<Install />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/panel" element={<PanelPreview />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  </StrictMode>,
);
