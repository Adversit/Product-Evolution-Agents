import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Stage from "./components/Stage";
import NodeDrawer from "./components/NodeDrawer";
import { usePipeline } from "./hooks/usePipeline";
import { useLive } from "./lib/live";
import { STEP_NAMES, TOTAL_STEPS } from "./lib/graph";
import { COLORS } from "./lib/theme";

export default function App() {
  const pipeline = usePipeline();
  const live = useLive();
  const [hover, setHover] = useState<string | null>(null);
  const [located, setLocated] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const { syncTo } = pipeline;
  const lastLiveStep = useRef<number | null>(null);

  // Drive the DAG lighting from real backend `node` events when streaming.
  useEffect(() => {
    if (live.liveStep === null) return;
    if (lastLiveStep.current === live.liveStep) return;
    lastLiveStep.current = live.liveStep;
    syncTo(live.liveStep);
  }, [live.liveStep, syncTo]);

  const { step } = pipeline;
  const stepLabel = `${step + 1} / ${TOTAL_STEPS} · ${STEP_NAMES[step]}`;

  const onLocate = (id: string) => setLocated((cur) => (cur === id ? null : id));

  return (
    <div
      style={{
        height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
        background: COLORS.canvas, color: COLORS.ink, fontFamily: "Inter,system-ui,sans-serif", overflow: "hidden",
      }}
    >
      <Header pipeline={pipeline} stepLabel={stepLabel} />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Stage
          step={step}
          anim={pipeline.anim}
          hover={hover}
          located={located}
          selected={selected}
          nodeRuntime={live.nodeRuntime}
          onHover={setHover}
          onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
        />
        <Sidebar located={located} onLocate={onLocate} />
        {selected && <NodeDrawer nodeId={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
