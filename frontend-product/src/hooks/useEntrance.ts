// HERO entrance animation — radar grows (t: 0→1) + total rolls 61→86, with a
// guaranteed final-state fallback so a throttled rAF never leaves it mid-tween.
// Also drives the 初评/终评 toggle re-tween. Ports _growRadar / _tweenTotal /
// setRound from the design's Component class.
import { useCallback, useEffect, useRef, useState } from "react";
import { D } from "../data/state";

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

export function useEntrance() {
  const [t, setT] = useState(0);
  const [total, setTotal] = useState(61);
  const [round, setRound] = useState(1);
  const rafA = useRef(0);
  const rafB = useRef(0);
  const fallback = useRef<ReturnType<typeof setTimeout>>();
  const fallback2 = useRef<ReturnType<typeof setTimeout>>();

  const tween = useCallback((from: number, to: number, dur: number, delay: number) => {
    cancelAnimationFrame(rafB.current);
    const start = performance.now() + delay;
    const step = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / dur));
      setTotal(Math.round(from + (to - from) * easeOutCubic(p)));
      if (p < 1) rafB.current = requestAnimationFrame(step);
    };
    rafB.current = requestAnimationFrame(step);
  }, []);

  const growRadar = useCallback((dur: number, delay: number) => {
    cancelAnimationFrame(rafA.current);
    const start = performance.now() + delay;
    const step = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / dur));
      setT(easeOutCubic(p));
      if (p < 1) rafA.current = requestAnimationFrame(step);
    };
    rafA.current = requestAnimationFrame(step);
  }, []);

  // mount: emphasize 终评, roll 61→86, grow radar; hard fallback at 1.5s.
  useEffect(() => {
    setRound(2);
    tween(61, 86, 1100, 250);
    growRadar(900, 250);
    fallback.current = setTimeout(() => {
      setT(1);
      setTotal(86);
      setRound(2);
    }, 1500);
    return () => {
      cancelAnimationFrame(rafA.current);
      cancelAnimationFrame(rafB.current);
      clearTimeout(fallback.current);
      clearTimeout(fallback2.current);
    };
  }, [tween, growRadar]);

  const switchRound = useCallback(
    (r: number) => {
      setRound((cur) => {
        if (r === cur) return cur;
        const to = r === 2 ? D.QUALITY.total_r2 : D.QUALITY.total_r1;
        setTotal((from) => {
          tween(from, to, 600, 0);
          return from;
        });
        clearTimeout(fallback2.current);
        fallback2.current = setTimeout(() => setTotal(to), 680);
        return r;
      });
    },
    [tween],
  );

  return { t, total, round, switchRound };
}
