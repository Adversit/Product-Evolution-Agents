import { useCallback, useEffect, useRef, useState } from "react";
import { TOTAL_STEPS } from "../lib/graph";

const LAST = TOTAL_STEPS - 1; // 13

export type Speed = 0.5 | 1 | 2;

export interface Pipeline {
  step: number;
  playing: boolean;
  anim: boolean;
  speed: Speed;
  togglePlay: () => void;
  step1: () => void;
  prev: () => void;
  reset: () => void;
  toggleAnim: () => void;
  cycleSpeed: () => void;
  // Drive the DAG from an external (live backend) step. Stops the fake timer and
  // jumps the lit node to `target`. Used when real `node` events arrive.
  syncTo: (target: number) => void;
}

// Drives the node-by-node light-up simulation. Mirrors the DCLogic timer in the design,
// re-expressed as a hook. Default starts at step 11 (critic active, most of the trail done).
export function usePipeline(initialStep = 11): Pipeline {
  const [step, setStep] = useState(initialStep);
  const [playing, setPlaying] = useState(false);
  const [anim, setAnim] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (sp: Speed) => {
      clear();
      timer.current = setInterval(() => {
        setStep((s) => {
          if (s >= LAST) {
            clear();
            setPlaying(false);
            return s;
          }
          return s + 1;
        });
      }, 1150 / sp);
    },
    [clear],
  );

  const togglePlay = useCallback(() => {
    if (playing) {
      clear();
      setPlaying(false);
      return;
    }
    setStep((s) => (s >= LAST ? 0 : s));
    setPlaying(true);
    startTimer(speed);
  }, [playing, speed, clear, startTimer]);

  const step1 = useCallback(() => {
    clear();
    setPlaying(false);
    setStep((s) => Math.min(LAST, s + 1));
  }, [clear]);

  const prev = useCallback(() => {
    clear();
    setPlaying(false);
    setStep((s) => Math.max(0, s - 1));
  }, [clear]);

  const reset = useCallback(() => {
    clear();
    setPlaying(false);
    setStep(0);
  }, [clear]);

  const syncTo = useCallback(
    (target: number) => {
      clear();
      setPlaying(false);
      setStep(Math.max(0, Math.min(LAST, target)));
    },
    [clear],
  );

  const toggleAnim = useCallback(() => setAnim((a) => !a), []);

  const cycleSpeed = useCallback(() => {
    setSpeed((sp) => {
      const next: Speed = sp === 1 ? 2 : sp === 2 ? 0.5 : 1;
      if (playing) startTimer(next);
      return next;
    });
  }, [playing, startTimer]);

  useEffect(() => clear, [clear]);

  return { step, playing, anim, speed, togglePlay, step1, prev, reset, toggleAnim, cycleSpeed, syncTo };
}
