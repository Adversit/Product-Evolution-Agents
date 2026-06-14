// EvoPM 决策工作台 — shell: sidebar + top context bar + screen switcher.
// Linear-style light theme. Loads the live run from the EvoPM FastAPI server
// (/api/state, adapted to the screen view-model). On fetch failure it falls back
// to the embedded data/state.ts labeled「离线样例 / offline sample」.
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
import { DataProvider } from "./data/DataContext";
import { D } from "./data/state";
import type { DecisionData } from "./data/state";
import { adaptState } from "./data/adapt";
import { ensureState } from "./lib/api";

export type Screen = "hero" | "overview" | "clusters" | "opportunity" | "eng" | "reports";

const crumbMap: Record<Screen, string> = {
  hero: "req-01 · focus",
  overview: "dashboard",
  clusters: "3 clusters",
  opportunity: "P0 · 86.6",
  eng: "12 tasks",
  reports: "4 reports",
};

type Load = { phase: "loading" } | { phase: "ready"; data: DecisionData; offline: boolean };

export default function App() {
  const [screen, setScreen] = useState<Screen>("hero");
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const mainRef = useRef<HTMLElement>(null);

  const go = (s: Screen) => setScreen(s);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const live = await ensureState();
        if (!alive) return;
        setLoad({ phase: "ready", data: adaptState(live), offline: false });
      } catch {
        if (!alive) return;
        // Live backend unavailable — fall back to the embedded offline sample.
        setLoad({ phase: "ready", data: D, offline: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [screen]);

  if (load.phase === "loading") return <Loading />;

  return (
    <DataProvider value={load.data}>
      <EvidenceProvider offline={load.offline}>
        <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "#FFFFFF" }}>
          <Sidebar screen={screen} go={go} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <Header crumb={crumbMap[screen]} offline={load.offline} />
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
    </DataProvider>
  );
}

function Loading() {
  return (
    <div style={{ height: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#8A8F98", fontSize: 13 }}>
        <span
          style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #E6E6E4", borderTopColor: "#5E6AD2", display: "inline-block", animation: "evspin .8s linear infinite" }}
        />
        正在加载运行状态 · evopm-server
      </div>
      <style>{`@keyframes evspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
