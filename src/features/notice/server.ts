import "server-only";

import { getMyAccount } from "@/features/account/server";
import { api, ApiError } from "@/lib/api";
import { getApiAccountContext } from "@/lib/api-account";
import { type AdminNoticeEntry,adminNoticesStore } from "@/mocks/admin";
import { isMock } from "@/mocks/config";
import type { components } from "@/types/api";

type Schemas = components["schemas"];
const PAGE_SIZE = 15;
const REMINDER_LEAD = 60 * 60 * 1000;
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
  const { init } = await getApiAccountContext();
  return api<Schemas["PageResponseNoticeSummaryResponse"]>(`/api/v1/notices?page=${page}&size=${PAGE_SIZE}`, init);
}

export async function getNotice(noticeId: number) {
  if (isMock) {
    await getMyAccount();
    const entry = adminNoticesStore.get(noticeId);
    if (!entry || !active(entry, Date.now())) return null;
    const { noticeType, title, content, displayStartsAt, displayEndsAt, maintenanceStartsAt } = entry;
    return { noticeId, noticeType, title, content, displayStartsAt, displayEndsAt, maintenanceStartsAt: maintenanceStartsAt ?? undefined };
  }
  const { init } = await getApiAccountContext();
  try {
    return await api<Schemas["NoticeResponse"] | null>(`/api/v1/notices/${noticeId}`, init);
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
    const maintenance = entries.filter((entry) => {
      if (entry.noticeType !== "MAINTENANCE" || !entry.maintenanceStartsAt || !active(entry, now)) return false;
      const startsAt = Date.parse(entry.maintenanceStartsAt);
      const remindAt = startsAt - REMINDER_LEAD;
      const dismissedAt = hidden?.get(entry.noticeId);
      return dismissedAt === undefined || (dismissedAt < remindAt && remindAt <= now && now < startsAt);
    }).sort((a, b) => Date.parse(a.maintenanceStartsAt ?? "") - Date.parse(b.maintenanceStartsAt ?? "") || newest(a, b));
    const entry = urgent[0] ?? maintenance[0];
    const boundaries = entries.flatMap(({ noticeType, displayStartsAt, displayEndsAt, maintenanceStartsAt }) => {
      if (noticeType === "URGENT") return [Date.parse(displayStartsAt), Date.parse(displayEndsAt)];
      if (noticeType !== "MAINTENANCE" || !maintenanceStartsAt) return [];
      const startsAt = Date.parse(maintenanceStartsAt);
      return [Date.parse(displayStartsAt), startsAt - REMINDER_LEAD, Date.parse(displayEndsAt), startsAt];
    });
    const next = Math.min(...boundaries.filter((time) => time > now));
    const banner = entry && { noticeId: entry.noticeId, noticeType: entry.noticeType, title: entry.title };
    return { banner, refreshAt: Number.isFinite(next) ? next : null };
  }

  const { init, query } = await getApiAccountContext();
  const data = await api<Schemas["ActiveNoticeResponse"]>(`/api/v1/notices/active?${query}`, init);
  const detail = data.banner?.noticeId ? await getNotice(data.banner.noticeId) : null;
  const endsAt = Date.parse(detail?.displayEndsAt ?? "");
  const now = Date.now();
  return {
    banner: data.banner && detail && !(endsAt <= now) ? data.banner : undefined,
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
  const { init, query } = await getApiAccountContext();
  await api<null>(`/api/v1/notices/${noticeId}/dismiss?${query}`, { ...init, method: "POST" });
}
