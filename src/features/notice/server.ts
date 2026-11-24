import "server-only";

import { getMyAccount } from "@/features/account/server";
import { api, ApiError } from "@/lib/api";
import { type AdminNoticeEntry,adminNoticesStore } from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

type Schemas = components["schemas"];
const PAGE_SIZE = 20;
const runtime = globalThis as typeof globalThis & { moaNoticeDismissals?: Map<number, Map<number, number>> };
const dismissals = (runtime.moaNoticeDismissals ??= new Map());

function active(entry: AdminNoticeEntry, now: number) {
  return Date.parse(entry.displayStartsAt) <= now && now < Date.parse(entry.displayEndsAt);
}

function newest(a: AdminNoticeEntry, b: AdminNoticeEntry) {
  return Date.parse(b.displayStartsAt) - Date.parse(a.displayStartsAt) || b.noticeId - a.noticeId;
}

export async function listNotices(page: number) {
  if (isMock) {
    await getMyAccount();
    const now = Date.now();
    const visible = [...adminNoticesStore.values()].filter((notice) => active(notice, now)).sort(newest);
    const content = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      .map(({ noticeId, noticeType, title, displayStartsAt }) => ({ noticeId, noticeType, title, displayStartsAt }));
    return { content, hasNext: (page + 1) * PAGE_SIZE < visible.length };
  }
  return api<Schemas["PageResponseNoticeSummaryResponse"]>(`/api/v1/notices?page=${page}&size=${PAGE_SIZE}`, { cache: "no-store" });
}

export async function getNotice(noticeId: number) {
  if (isMock) {
    await getMyAccount();
    const entry = adminNoticesStore.get(noticeId);
    if (!entry || !active(entry, Date.now())) return null;
    const { noticeType, title, content, displayStartsAt, displayEndsAt, maintenanceStartsAt } = entry;
    return { noticeId, noticeType, title, content, displayStartsAt, displayEndsAt, maintenanceStartsAt: maintenanceStartsAt ?? undefined };
  }
  try {
    return await api<Schemas["NoticeResponse"] | null>(`/api/v1/notices/${noticeId}`, { cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getNoticeBanner() {
  if (isMock) {
    const { id } = await getMyAccount();
    const now = Date.now();
    const hidden = dismissals.get(id);
    const entries = [...adminNoticesStore.values()];
    const urgent = entries.filter((entry) =>
      entry.noticeType === "URGENT" && active(entry, now) && !hidden?.has(entry.noticeId),
    ).sort(newest);
    const maintenance = entries.filter((entry) =>
      entry.noticeType === "MAINTENANCE" && active(entry, now) &&
      (!hidden?.has(entry.noticeId) || Date.parse(entry.maintenanceStartsAt ?? "") > now),
    ).sort(newest);
    const entry = urgent[0] ?? maintenance[0];
    const boundaries = entries.filter(({ noticeType }) => noticeType !== "GENERAL")
      .flatMap(({ displayStartsAt, displayEndsAt, maintenanceStartsAt }) => [
        Date.parse(displayStartsAt), Date.parse(displayEndsAt), Date.parse(maintenanceStartsAt ?? ""),
      ]);
    const next = Math.min(...boundaries.filter((time) => time > now));
    const banner = entry && { noticeId: entry.noticeId, noticeType: entry.noticeType, title: entry.title };
    return { banner, refreshAt: Number.isFinite(next) ? next : null };
  }

  const data = await api<Schemas["ActiveNoticeResponse"]>("/api/v1/notices/active", { cache: "no-store" });
  const now = Date.now();
  const urgent = data.banner?.noticeType === "URGENT" ? data.banner : undefined;
  const urgentEndsAt = Date.parse(data.notices?.find(({ noticeId }) => noticeId === urgent?.noticeId)?.displayEndsAt ?? "");
  const maintenance = data.notices?.find(({ noticeType, displayEndsAt }) =>
    noticeType === "MAINTENANCE" && !(Date.parse(displayEndsAt ?? "") <= now),
  );
  const showUrgent = !!urgent && !(urgentEndsAt <= now);
  const endsAt = showUrgent ? urgentEndsAt : Date.parse(maintenance?.displayEndsAt ?? "");
  return {
    banner: showUrgent ? urgent : maintenance,
    refreshAt: Number.isFinite(endsAt) && endsAt > now ? endsAt : null,
  };
}

export async function dismissNotice(noticeId: number) {
  if (isMock) {
    const { id } = await getMyAccount();
    const now = Date.now();
    const entry = adminNoticesStore.get(noticeId);
    if (!entry || !active(entry, now)) return;
    const hidden = dismissals.get(id) ?? new Map<number, number>();
    hidden.set(noticeId, now);
    dismissals.set(id, hidden);
    return;
  }
  await api<null>(`/api/v1/notices/${noticeId}/dismiss`, { cache: "no-store", method: "POST" });
}
