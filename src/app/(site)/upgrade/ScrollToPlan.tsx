"use client";

import { useEffect } from "react";

/** Brings the plan from a renewal reminder link into view. */
export function ScrollToPlan({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [id]);
  return null;
}
