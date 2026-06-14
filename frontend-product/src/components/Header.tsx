// Top context bar — breadcrumb + per-screen mono crumb + PM avatar. Product name /
// module / stage come from the active dataset; an offline badge shows when the live
// backend was unreachable and the embedded sample is in use.
import { useData } from "../data/DataContext";

export default function Header({ crumb, offline = false }: { crumb: string; offline?: boolean }) {
  const p = useData().PRODUCT;
  return (
    <header style={{ height: 56, flexShrink: 0, background: "rgba(255,255,255,.82)", backdropFilter: "blur(8px)", borderBottom: "1px solid #ECECEA", display: "flex", alignItems: "center", padding: "0 26px", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#56595F" }}>
        <span style={{ fontWeight: 600, color: "#1B1C1E" }}>{p.name || "RAGFlow"}</span>
        <span style={{ color: "#D8D8D6" }}>/</span>
        <span>{p.module || "文件上传与问答质量"}</span>
        {p.stage && <span style={{ fontSize: 10.5, fontWeight: 600, color: "#56595F", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "1px 7px", borderRadius: 5, marginLeft: 2 }}>{p.stage}</span>}
      </div>
      <div style={{ flex: 1 }} />
      {offline && (
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8F98", background: "#F4F4F3", border: "1px solid #E6E6E4", padding: "2px 9px", borderRadius: 6 }} title="后端不可达，使用内置离线样例">
          离线样例 · offline sample
        </span>
      )}
      <div style={{ fontSize: 11.5, color: "#8A8F98", fontFamily: "'JetBrains Mono',monospace" }}>{crumb}</div>
      <div style={{ width: 1, height: 18, background: "#E6E6E4" }} />
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1B1C1E", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>PM</div>
    </header>
  );
}
