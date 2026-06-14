// EvoPM 决策工作台 — shell: sidebar + top context bar + screen switcher.
// Linear-style light theme over a static glm-5.1 replay run (no backend wiring).
import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { EvidenceProvider } from "./components/Evidence";
import Hero from "./screens/Hero";
import Overview from "./screens/Overview";
import Clusters from "./screens/Clusters";
import Opportunity from "./screens/Opportunity";
import Engineering from "./screens/Engineering";
import Reports from "./screens/Reports";

export type Screen = "hero" | "overview" | "clusters" | "opportunity" | "eng" | "reports";

const crumbMap: Record<Screen, string> = {
  hero: "req-01 · focus",
  overview: "dashboard",
  clusters: "3 clusters",
  opportunity: "P0 · 86.6",
  eng: "12 tasks",
  reports: "4 reports",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("hero");
  const mainRef = useRef<HTMLElement>(null);

  // Re-mount Hero on each visit so the entrance animation replays, matching the design.
  const go = (s: Screen) => setScreen(s);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [screen]);

  return (
    <EvidenceProvider>
      <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "#FFFFFF" }}>
        <Sidebar screen={screen} go={go} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <Header crumb={crumbMap[screen]} />
          <main ref={mainRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {screen === "hero" && <Hero />}
            {screen === "overview" && <Overview />}
            {screen === "clusters" && <Clusters />}
            {screen === "opportunity" && <Opportunity />}
            {screen === "eng" && <Engineering />}
            {screen === "reports" && <Reports />}
          </main>
        </div>
      </div>
    </EvidenceProvider>
  );
}
