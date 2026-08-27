"use client";

import { useEffect, useState } from "react";

// Apple defaults: damping 1.0 critically damped, response ~0.35s = bounce 0
export const SPRING_DEFAULT = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.35,
};

export const STAGGER_CONTAINER = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
};

export const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: SPRING_DEFAULT },
};

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const cb = () => setReduced(m.matches);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  }, []);
  return reduced;
}
