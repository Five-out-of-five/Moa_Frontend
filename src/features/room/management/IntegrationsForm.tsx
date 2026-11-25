"use client";

import { AlertTriangle, Link2, Loader2, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authorizeNotionAction,
  deleteNotionIntegrationAction,
  updateNotionIntegrationAction,
} from "@/features/notion-integration/actions";
import type {
  NotionDatabase,
  NotionExportMode,
  NotionIntegration,
} from "@/features/notion-integration/types";
import {
  deleteSlackIntegrationAction,
  testSlackIntegrationAction,
  upsertSlackIntegrationAction,
} from "@/features/slack-integration/actions";
import type {
  SlackEventType,
  SlackIntegration,
} from "@/features/slack-integration/types";
import { cn } from "@/lib/utils";

/**
 * Slack 이벤트 라벨 — BE enum 그대로 (승재님 2026-11-25 합의, A안).
 * `SESSION_SUMMARY` 는 "요약" 이 아니라 **마감 알림**만 가는 상태라 "세션 종료" 로 표기.
 */
const SLACK_EVENT_LABELS: Record<SlackEventType, string> = {
  VOTE_CREATED: "투표 시작",
  VOTE_CLOSED: "투표 마감",
  TASK_DUE_SOON: "업무 마감 임박",
  SESSION_SUMMARY: "세션 종료",
};
const SLACK_EVENT_ORDER: SlackEventType[] = [
  "VOTE_CREATED",
  "VOTE_CLOSED",
  "TASK_DUE_SOON",
  "SESSION_SUMMARY",
];

const NOTION_MODE_LABELS: Record<NotionExportMode, { title: string; description: string }> = {
  MANUAL: {
    title: "직접 내보내기",
    description: "필요할 때 직접 실행합니다.",
  },
  ON_SESSION_CLOSE: {
    title: "세션 종료 시",
    description: "세션이 끝나면 자동으로 내보냅니다.",
  },
};

/** webhookUrl 비어 있거나 masked(**** 포함) 면 "유지" 의미로 저장 시 제외. */
function isWebhookEditable(url: string): boolean {
  return url.length > 0 && !url.includes("****");
}

/** BE 가 빈 title 을 그대로 넘겨 올 수 있어 UI 표시용 fallback. 승재님 2026-11-25 요청. */
function displayDbTitle(title: string | null | undefined): string {
  if (title == null) return "제목 없음";
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "제목 없음";
}

interface Props {
  roomId: number;
  isOwner: boolean;
  initialSlack: SlackIntegration | null;
  initialNotion: NotionIntegration | null;
  notionDatabases: NotionDatabase[];
  /** Panel 쪽에서 Slack 조회가 실패했는지. 폼은 미연결과 구분해 에러 안내를 켠다. */
  slackLoadError?: boolean;
  notionLoadError?: boolean;
  databasesLoadError?: boolean;
}

export function IntegrationsForm({
  roomId,
  isOwner,
  initialSlack,
  initialNotion,
  notionDatabases,
  slackLoadError = false,
  notionLoadError = false,
  databasesLoadError = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // --- Slack baseline — 저장 성공 시 교체해 dirty 비교 기준을 최신값으로 재바인딩 (CodeRabbit).
  //     useState 초기값은 props 가 새로 와도 재적용 안 되므로 성공 응답으로 직접 갱신한다.
  const [slackBaseline, setSlackBaseline] = useState<SlackIntegration | null>(initialSlack);
  // ⚠️ 폼 확장 상태 — Notion 과 UX 통일. **연동 전엔 "Slack 연결하기" 버튼만** 노출하고,
  //    사용자가 눌러야 웹훅 입력·이벤트 체크박스가 펼쳐진다. 연결된 상태라면 자동 펼침.
  const [slackExpanded, setSlackExpanded] = useState<boolean>(initialSlack?.connected === true);
  const [slackWebhook, setSlackWebhook] = useState(slackBaseline?.webhookUrlMasked ?? "");
  const [slackEvents, setSlackEvents] = useState<Set<SlackEventType>>(
    new Set(slackBaseline?.eventTypes ?? []),
  );
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackTestState, setSlackTestState] = useState<"idle" | "sent" | "failed">("idle");

  // --- Notion baseline — 마찬가지. savedDbId·savedDbInList 가 전부 baseline 기반.
  const [notionBaseline, setNotionBaseline] = useState<NotionIntegration | null>(initialNotion);
  const notionConnected = Boolean(
    notionBaseline?.connected && !notionBaseline.tokenExpired,
  );
  const savedDbId = notionBaseline?.targetDatabase?.id ?? null;
  const savedDbInList =
    savedDbId != null && notionDatabases.some((db) => db.id === savedDbId);
  const savedDbTitle = useMemo(() => {
    if (notionBaseline?.targetDatabase?.title) {
      return displayDbTitle(notionBaseline.targetDatabase.title);
    }
    if (savedDbId) {
      const found = notionDatabases.find((db) => db.id === savedDbId);
      return found ? displayDbTitle(found.title) : null;
    }
    return null;
  }, [notionBaseline, notionDatabases, savedDbId]);
  const [notionDbId, setNotionDbId] = useState<string>(savedDbInList ? (savedDbId as string) : "");
  const [notionMode, setNotionMode] = useState<NotionExportMode>(
    notionBaseline?.exportMode ?? "MANUAL",
  );
  const [notionError, setNotionError] = useState<string | null>(null);

  // --- 변경 감지 ---
  const needsSlackReenable = slackBaseline?.connected === true && slackBaseline.enabled === false;
  const slackDirty = useMemo(() => {
    const initialEvents = new Set(slackBaseline?.eventTypes ?? []);
    if (slackEvents.size !== initialEvents.size) return true;
    for (const ev of slackEvents) if (!initialEvents.has(ev)) return true;
    if (isWebhookEditable(slackWebhook)) return true;
    return false;
  }, [slackBaseline, slackEvents, slackWebhook]);
  const slackCanSave = slackDirty || needsSlackReenable;

  const notionDirty = useMemo(() => {
    if (!notionConnected) return false;
    if (!notionDbId) return false;
    if (notionDbId !== savedDbId) return true;
    if (notionMode !== (notionBaseline?.exportMode ?? "MANUAL")) return true;
    return false;
  }, [notionConnected, notionDbId, savedDbId, notionMode, notionBaseline]);

  // 폼이 접힌 상태에서는 Slack 저장이 일어나지 않아야 한다 (사용자 미인지 저장 방지).
  const slackSavable = slackExpanded && slackCanSave;
  const canSubmit = !pending && isOwner && (slackSavable || notionDirty);

  // 비방장 — 저장·OAuth 전부 BE 가 거절. UI 는 안내 패널만 노출.
  if (!isOwner) {
    return (
      <div className="p-5">
        <section className="rounded-card border p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <h3 className="font-semibold">방장만 외부 연동을 설정할 수 있어요</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Slack 알림·Notion 내보내기 설정은 방장 권한이 필요합니다. 방장에게 요청해 주세요.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const handleToggleEvent = (event: SlackEventType) => {
    setSlackEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const handleTestSlack = () => {
    setSlackError(null);
    setSlackTestState("idle");
    startTransition(async () => {
      const result = await testSlackIntegrationAction({
        roomId,
        webhookUrl: slackWebhook.trim(),
      });
      if (result.kind === "ok") setSlackTestState("sent");
      else {
        setSlackTestState("failed");
        setSlackError(result.message);
      }
    });
  };

  const handleAuthorizeNotion = () => {
    setNotionError(null);
    startTransition(async () => {
      const result = await authorizeNotionAction({ roomId });
      if (result.kind === "ok") {
        window.location.href = result.authorizeUrl;
      } else {
        setNotionError(result.message);
      }
    });
  };

  const handleDisconnectNotion = () => {
    setNotionError(null);
    startTransition(async () => {
      const result = await deleteNotionIntegrationAction({ roomId });
      if (result.kind === "error") setNotionError(result.message);
    });
  };

  const handleDisconnectSlack = () => {
    setSlackError(null);
    startTransition(async () => {
      const result = await deleteSlackIntegrationAction({ roomId });
      if (result.kind === "error") setSlackError(result.message);
    });
  };

  const handleSave = () => {
    setSlackError(null);
    setNotionError(null);
    startTransition(async () => {
      if (slackSavable) {
        const result = await upsertSlackIntegrationAction({
          roomId,
          webhookUrl: isWebhookEditable(slackWebhook) ? slackWebhook.trim() : undefined,
          eventTypes: Array.from(slackEvents),
        });
        if (result.kind === "error") {
          setSlackError(result.message);
          return;
        }
        // 저장 성공: baseline 과 입력값을 응답 기준으로 리셋 → dirty=false, 저장 버튼 비활성화.
        setSlackBaseline(result.integration);
        setSlackWebhook(result.integration.webhookUrlMasked ?? "");
        setSlackEvents(new Set(result.integration.eventTypes));
        setSlackTestState("idle");
      }
      if (notionDirty) {
        const result = await updateNotionIntegrationAction({
          roomId,
          targetDatabaseId: notionDbId,
          exportMode: notionMode,
        });
        if (result.kind === "database_not_found") {
          setNotionError("선택한 노션 DB 에 접근할 수 없어요. 목록에서 다시 선택해 주세요.");
          return;
        }
        if (result.kind === "auth_expired") {
          setNotionError("노션 토큰이 만료됐어요. 재연결 후 다시 저장해 주세요.");
          return;
        }
        if (result.kind === "error") {
          setNotionError(result.message);
          return;
        }
        setNotionBaseline(result.integration);
        setNotionMode(result.integration.exportMode);
      }
    });
  };

  return (
    <div className="space-y-4 p-5">
      {/* Slack 알림 카드 */}
      <section className="rounded-card border p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="bg-secondary grid size-8 place-items-center rounded-md"
            >
              <Image src="/icons/slack.svg" alt="" width={18} height={18} />
            </span>
            <div>
              <h3 className="font-semibold">Slack 알림</h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                선택한 활동을 Slack 채널로 전달합니다.
              </p>
            </div>
          </div>
          {slackBaseline?.connected ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleDisconnectSlack} disabled={pending}>
              연결 해제
            </Button>
          ) : (
            !slackExpanded && !slackLoadError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSlackExpanded(true)}
                disabled={pending}
              >
                <Link2 aria-hidden="true" className="size-4" />
                Slack 연결하기
              </Button>
            )
          )}
        </header>

        {slackLoadError ? (
          <LoadErrorBanner
            message="슬랙 연동 정보를 불러오지 못했어요."
            onRetry={() => router.refresh()}
            pending={pending}
          />
        ) : !slackExpanded ? null : (
          <>
            {needsSlackReenable && (
              <div className="bg-destructive/10 text-destructive mt-3 flex items-start gap-2 rounded-md p-2 text-xs">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <p>
                  {slackBaseline?.consecutiveFailCount}회 연속 실패로 비활성화됐어요.
                  {slackBaseline?.disabledAt && ` (${formatDate(slackBaseline.disabledAt)})`}
                  {" "}
                  <strong>저장하면 다시 켜져요.</strong>
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slack-webhook" className="text-xs font-medium">수신 웹훅 주소</Label>
                <Input
                  id="slack-webhook"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="Slack 수신 웹훅 주소를 입력하세요"
                  disabled={pending}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {slackTestState === "sent" && "테스트 메시지를 보냈어요."}
                    {slackTestState === "failed" && "테스트 발송 실패"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestSlack}
                    disabled={pending || !isWebhookEditable(slackWebhook)}
                  >
                    테스트 발송
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">알림 이벤트</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SLACK_EVENT_ORDER.map((event) => {
                    const checked = slackEvents.has(event);
                    return (
                      <label
                        key={event}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm",
                          checked ? "border-primary bg-primary/5" : "border-border bg-background",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleEvent(event)}
                          disabled={pending}
                          className="accent-primary"
                        />
                        <span>{SLACK_EVENT_LABELS[event]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            {slackError && (
              <p className="text-destructive mt-3 text-sm" role="alert">{slackError}</p>
            )}
            {slackEvents.size === 0 && !needsSlackReenable && (
              <p className="text-muted-foreground mt-2 text-xs">
                알림 이벤트가 하나도 선택되지 않으면 Slack 발송이 일어나지 않아요.
              </p>
            )}
          </>
        )}
      </section>

      {/* Notion 내보내기 카드 */}
      <section className="rounded-card border p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="bg-secondary grid size-8 place-items-center rounded-md"
            >
              <Image src="/icons/notion.svg" alt="" width={18} height={18} />
            </span>
            <div>
              <h3 className="font-semibold">Notion 내보내기</h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                세션 결과를 지정한 데이터베이스에 정리합니다.
              </p>
              {notionConnected && notionBaseline?.workspaceName && (
                <p className="text-muted-foreground mt-1 text-xs">
                  연결된 워크스페이스 · {notionBaseline.workspaceName}
                </p>
              )}
              {notionBaseline?.tokenExpired && (
                <p className="text-destructive mt-1 text-xs">
                  토큰이 만료되어 재연결이 필요해요.
                </p>
              )}
            </div>
          </div>
          {notionConnected ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleDisconnectNotion} disabled={pending}>
              연결 해제
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAuthorizeNotion}
              disabled={pending || notionLoadError}
            >
              <Link2 aria-hidden="true" className="size-4" />
              연결하기
            </Button>
          )}
        </header>

        {notionLoadError ? (
          <LoadErrorBanner
            message="노션 연동 정보를 불러오지 못했어요."
            onRetry={() => router.refresh()}
            pending={pending}
          />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notion-db" className="text-xs font-medium">Notion 데이터베이스</Label>
              <select
                id="notion-db"
                value={notionDbId}
                onChange={(e) => setNotionDbId(e.target.value)}
                disabled={!notionConnected || pending || databasesLoadError}
                className="border-border bg-background text-foreground h-9 rounded-md border px-3 text-sm disabled:opacity-50"
              >
                <option value="">
                  {notionConnected ? "데이터베이스를 선택하세요" : "먼저 Notion 을 연결해 주세요"}
                </option>
                {notionDatabases.map((db) => (
                  <option key={db.id} value={db.id}>{displayDbTitle(db.title)}</option>
                ))}
              </select>
              {databasesLoadError ? (
                <p className="text-destructive text-xs">
                  데이터베이스 목록을 불러오지 못했어요.{" "}
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    disabled={pending}
                    className="underline"
                  >
                    새로고침
                  </button>
                </p>
              ) : (
                <>
                  {notionConnected && savedDbId && !savedDbInList && (
                    <p className="text-destructive text-xs">
                      기존에 저장된 DB{savedDbTitle ? ` (${savedDbTitle})` : ""} 가 목록에 없어요. 다시 선택해 주세요.
                    </p>
                  )}
                  {notionConnected && notionDatabases.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      연결된 워크스페이스에 접근 가능한 데이터베이스가 없어요.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">내보내기 방식</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(NOTION_MODE_LABELS) as NotionExportMode[]).map((mode) => {
                  const checked = notionMode === mode;
                  return (
                    <label
                      key={mode}
                      className={cn(
                        "flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 text-sm",
                        checked ? "border-primary bg-primary/5" : "border-border bg-background",
                        !notionConnected && "opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="notion-mode"
                          checked={checked}
                          onChange={() => setNotionMode(mode)}
                          disabled={!notionConnected || pending}
                          className="accent-primary"
                        />
                        <span className="font-medium">{NOTION_MODE_LABELS[mode].title}</span>
                      </div>
                      <span className="text-muted-foreground ml-6 text-xs">
                        {NOTION_MODE_LABELS[mode].description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {notionError && (
          <p className="text-destructive mt-3 text-sm" role="alert">{notionError}</p>
        )}
      </section>

      {/* 하단 저장 */}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" onClick={handleSave} disabled={!canSubmit}>
          {pending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          연동 설정 저장
        </Button>
      </div>
    </div>
  );
}

/** 섹션 조회 실패 안내 + 새로고침 버튼 — Slack·Notion 섹션 공용. */
function LoadErrorBanner({
  message,
  onRetry,
  pending,
}: {
  message: string;
  onRetry: () => void;
  pending: boolean;
}) {
  return (
    <div className="bg-destructive/10 text-destructive mt-3 flex items-center justify-between gap-2 rounded-md p-2 text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={pending}
        className="gap-1"
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        새로고침
      </Button>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
