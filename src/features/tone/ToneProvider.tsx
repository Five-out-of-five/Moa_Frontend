"use client";

import { createContext, useContext } from "react";

import type { ToneMode } from "@/types/db";

const ToneContext = createContext<ToneMode | null>(null);
export function ToneProvider({
  mode,
  children,
}: {
  mode: ToneMode | null;
  children: React.ReactNode;
}) {
  return <ToneContext.Provider value={mode}>{children}</ToneContext.Provider>;
}
export const useToneMode = () => useContext(ToneContext);
