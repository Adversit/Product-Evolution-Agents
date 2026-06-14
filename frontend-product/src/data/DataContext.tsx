// Provides the active DecisionData view-model to every screen. App loads the live
// /api/state on mount, adapts it, and supplies it here; screens read it via
// useData() instead of importing the static module-level `D`. On fetch failure the
// embedded data/state.ts is used as the offline sample (never a blank screen).
import { createContext, useContext } from "react";
import type { DecisionData } from "./state";

const DataContext = createContext<DecisionData | null>(null);

export function DataProvider({ value, children }: { value: DecisionData; children: React.ReactNode }) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// The active dataset. Throws if used outside the provider (a programming error).
export function useData(): DecisionData {
  const v = useContext(DataContext);
  if (!v) throw new Error("useData must be used within DataProvider");
  return v;
}
