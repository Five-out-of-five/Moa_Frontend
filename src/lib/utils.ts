import { type ClassValue,clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스 결합 유틸 — shadcn 기본 cn.
 * 조건부 클래스를 안전하게 합치고 충돌하는 유틸리티는 뒤쪽을 우선한다.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
