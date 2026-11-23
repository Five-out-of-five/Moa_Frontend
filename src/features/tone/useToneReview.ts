"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { reviewToneAction } from "./actions";
import type { ToneTarget } from "./model";
import { useToneMode } from "./ToneProvider";

export function useToneReview(
  target: ToneTarget,
  value: string,
  maxLength: number,
  onApply: (text: string) => void,
) {
  const mode = useToneMode();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<{
    original: string;
    suggestion: string;
    needsChange: boolean;
  } | null>(null);
  const [error, setError] = useState<string>();
  const latest = useRef(value);
  latest.current = value;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const unavailable = mode === null || mode === "OFF";
  const hasChanged = Boolean(result && result.original !== value);

  function review() {
    if (isPending || unavailable || !value.trim()) return;
    const original = value;
    setIsOpen(true);
    setError(undefined);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await reviewToneAction(target, original, maxLength);
        if (!mounted.current) return;
        if (!response.ok) setError(response.error);
        else if (response.suggestion.length > maxLength)
          setError("제안이 입력 가능한 길이를 넘었어요. 원문을 줄인 뒤 다시 검토해 주세요.");
        else
          setResult({
            original,
            suggestion: response.suggestion,
            needsChange: response.needsChange,
          });
      } catch {
        if (mounted.current) setError("검토하지 못했어요. 원문을 유지하고 다시 시도해 주세요.");
      }
    });
  }
  function apply() {
    if (!result?.needsChange || unavailable || isPending) return;
    if (latest.current !== result.original) {
      setError("원문이 변경됐어요. 다시 검토해 주세요.");
      return;
    }
    onApply(result.suggestion);
    setIsOpen(false);
  }
  return {
    mode,
    unavailable,
    hasChanged,
    isPending,
    isOpen,
    setIsOpen,
    result,
    error,
    review,
    apply,
  };
}
