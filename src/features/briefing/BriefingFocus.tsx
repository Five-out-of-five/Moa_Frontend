"use client";

import { useEffect } from "react";

export function BriefingFocus({ ids }: { ids: number[] }) {
  useEffect(() => {
    const nodes = ids.flatMap((id) => Array.from(document.querySelectorAll<HTMLElement>(`[data-briefing-id="${id}"]`)));
    if (!nodes.length) return;
    nodes[0].scrollIntoView({ block: "center" });
    for (const node of nodes) node.dataset.briefingHighlight = "true";
    const clear = () => {
      for (const node of nodes) delete node.dataset.briefingHighlight;
    };
    const timer = window.setTimeout(clear, 3000);
    return () => { window.clearTimeout(timer); clear(); };
  }, [ids]);
  return null;
}
