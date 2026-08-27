"use client";

import { motion } from "motion/react";
import { STAGGER_CONTAINER, STAGGER_ITEM, SPRING_DEFAULT, usePrefersReducedMotion } from "./motion";

export function KpiBento({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{children}</div>;
  }
  return (
    <motion.div
      variants={STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      {children}
    </motion.div>
  );
}

export function KpiBentoItem({ children, hero }: { children: React.ReactNode; hero?: boolean }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={hero ? "lg:col-span-2" : ""}>{children}</div>;
  }
  return (
    <motion.div variants={STAGGER_ITEM} transition={SPRING_DEFAULT} className={hero ? "lg:col-span-2" : ""}>
      {children}
    </motion.div>
  );
}
