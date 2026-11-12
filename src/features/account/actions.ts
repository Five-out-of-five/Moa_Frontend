"use server";

import { redirect } from "next/navigation";

import { api } from "@/lib/api";
import { isMock } from "@/mocks/config";

/**
 * 로그아웃 — 프로필 드롭다운에서 부른다.
 *
 * ⚠️ 목 모드에선 세션 개념이 없어 바로 /login 으로 보낸다. BE 가 붙으면 쿠키를 무효화하는
 *    `POST /auth/logout` 을 거친다.
 */
export async function logoutAction() {
  if (!isMock) {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // 실패해도 클라이언트 세션은 비워 로그인 화면으로 보낸다.
    }
  }
  redirect("/login");
}
