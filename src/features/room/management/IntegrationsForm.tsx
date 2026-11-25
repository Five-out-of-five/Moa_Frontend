"use client";

import { AlertTriangle, Database, Link2, Loader2, MessageSquare } from "lucide-react";
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
 * Slack 이벤트 라벨 — BE enum 그대로 사용하고 한글 라벨은 사용자 시각 어구로.
 *
 * ⚠️ Figma Make 에 그려진 라벨 ("새 안건 배정 / 댓글 및 멘션") 2개는 BE enum 에 없어 **노출
 *    불가**. 승재님 쪽 BE 지원 여부 확정 뒤 라벨·enum 모두 조정 예정. 지금은 BE 가 실제로
 *    발송 가능한 4개만 체크박스로 노출해 저장 성공·실패와 UI 가 일치하도록 한다.
 */
const SLACK_EVENT_LABELS: Record<SlackEventType, string> = {
  VOTE_CREATED: "투표 시작",
  VOTE_CLOSED: "투표 마감",
  TASK_DUE_SOON: "업무 마감 임박",
  SESSION_SUMMARY: "세션 종료 요약",
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

interface Props {
  roomId: number;
  initialSlack: SlackIntegration | null;
  initialNotion: NotionIntegration | null;
  notionDatabases: NotionDatabase[];
}

export function IntegrationsForm({
  roomId,
  initialSlack,
  initialNotion,
  notionDatabases,
}: Props) {
  // --- Slack 섹션 state ---
  // connected 여부는 initialSlack 에서 직접 읽어 표시용으로만 쓴다.
  const slackEnabled = initialSlack?.connected ?? false;
  const [slackWebhook, setSlackWebhook] = useState(
    initialSlack?.webhookUrlMasked ?? "",
  );
  const [slackEvents, setSlackEvents] = useState<Set<SlackEventType>>(
    new Set(initialSlack?.eventTypes ?? []),
  );
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackTestState, setSlackTestState] = useState<"idle" | "sent" | "failed">("idle");

  // --- Notion 섹션 state ---
  const notionConnected = Boolean(
    initialNotion?.connected && !initialNotion.tokenExpired,
  );
  const [notionDatabaseInput, setNotionDatabaseInput] = useState(
    initialNotion?.targetDatabase?.title ?? "",
  );
  const [notionMode, setNotionMode] = useState<NotionExportMode>(
    initialNotion?.exportMode ?? "MANUAL",
  );
  const [notionError, setNotionError] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  // --- 변경 감지 — "변경된 섹션만 저장" 하도록 ---
  const slackDirty = useMemo(() => {
    const initialEvents = new Set(initialSlack?.eventTypes ?? []);
    if (slackEvents.size !== initialEvents.size) return true;
    for (const ev of slackEvents) if (!initialEvents.has(ev)) return true;
    if (isWebhookEditable(slackWebhook)) return true;
    return false;
  }, [initialSlack, slackEvents, slackWebhook]);

  const notionDirty = useMemo(() => {
    if (!notionConnected) return false;
    const matched = matchDatabase(notionDatabaseInput, notionDatabases);
    const initialId = initialNotion?.targetDatabase?.id ?? null;
    if ((matched?.id ?? null) !== initialId) return true;
    if (notionMode !== (initialNotion?.exportMode ?? "MANUAL")) return true;
    return false;
  }, [notionConnected, notionDatabaseInput, notionMode, initialNotion, notionDatabases]);

  const canSubmit = !pending && (slackDirty || notionDirty);

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
      // 성공 시 revalidatePath 로 서버 상태 refresh 됨 → 다음 렌더에서 initialNotion 재주입.
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
      if (slackDirty) {
        const result = await upsertSlackIntegrationAction({
          roomId,
          webhookUrl: isWebhookEditable(slackWebhook) ? slackWebhook.trim() : undefined,
          eventTypes: Array.from(slackEvents),
        });
        if (result.kind === "error") {
          setSlackError(result.message);
          return;
        }
      }
      if (notionDirty) {
        const matched = matchDatabase(notionDatabaseInput, notionDatabases);
        if (!matched) {
          setNotionError("Notion 데이터베이스 목록에서 찾을 수 없어요.");
          return;
        }
        const result = await updateNotionIntegrationAction({
          roomId,
          targetDatabaseId: matched.id,
          exportMode: notionMode,
        });
        if (result.kind === "error") setNotionError(result.message);
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
              className="bg-secondary text-secondary-foreground grid size-8 place-items-center rounded-md"
            >
              <MessageSquare className="size-4" />
            </span>
            <div>
              <h3 className="font-semibold">Slack 알림</h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                선택한 활동을 Slack 채널로 전달합니다.
              </p>
            </div>
          </div>
          {initialSlack?.connected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDisconnectSlack}
              disabled={pending}
            >
              연결 해제
            </Button>
          )}
        </header>

        {initialSlack && !initialSlack.enabled && (
          <div className="bg-destructive/10 text-destructive mt-3 flex items-start gap-2 rounded-md p-2 text-xs">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <p>
              {initialSlack.consecutiveFailCount}회 연속 실패로 비활성화됐어요.
              {initialSlack.disabledAt && ` (${formatDate(initialSlack.disabledAt)})`}
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slack-webhook" className="text-xs font-medium">
              수신 웹훅 주소
            </Label>
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
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background",
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
          <p className="text-destructive mt-3 text-sm" role="alert">
            {slackError}
          </p>
        )}
        <SlackEnabledHint enabled={slackEnabled} />
      </section>

      {/* Notion 내보내기 카드 */}
      <section className="rounded-card border p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="bg-secondary text-secondary-foreground grid size-8 place-items-center rounded-md"
            >
              <Database className="size-4" />
            </span>
            <div>
              <h3 className="font-semibold">Notion 내보내기</h3>
              <p className="text-muted-foreground mt-0.5 text-sm">
                세션 결과를 지정한 데이터베이스에 정리합니다.
              </p>
              {notionConnected && initialNotion?.workspaceName && (
                <p className="text-muted-foreground mt-1 text-xs">
                  연결된 워크스페이스 · {initialNotion.workspaceName}
                </p>
              )}
              {initialNotion?.tokenExpired && (
                <p className="text-destructive mt-1 text-xs">
                  토큰이 만료되어 재연결이 필요해요.
                </p>
              )}
            </div>
          </div>
          {notionConnected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDisconnectNotion}
              disabled={pending}
            >
              연결 해제
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAuthorizeNotion}
              disabled={pending}
            >
              <Link2 aria-hidden="true" className="size-4" />
              연결하기
            </Button>
          )}
        </header>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notion-db" className="text-xs font-medium">
              Notion 데이터베이스
            </Label>
            <Input
              id="notion-db"
              list="notion-db-options"
              value={notionDatabaseInput}
              onChange={(e) => setNotionDatabaseInput(e.target.value)}
              placeholder={notionConnected ? "데이터베이스 이름 또는 링크" : "먼저 Notion 을 연결해 주세요"}
              disabled={!notionConnected || pending}
            />
            {notionDatabases.length > 0 && (
              <datalist id="notion-db-options">
                {notionDatabases.map((db) => (
                  <option key={db.id} value={db.title} />
                ))}
              </datalist>
            )}
            {notionDatabases.length === 0 && notionConnected && (
              <p className="text-muted-foreground text-xs">
                연결된 워크스페이스에 접근 가능한 데이터베이스가 없어요.
              </p>
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
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background",
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
        {notionError && (
          <p className="text-destructive mt-3 text-sm" role="alert">
            {notionError}
          </p>
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

/**
 * Slack 전체 토글은 BE 에 "비활성화 전용 API" 가 없어서 현재는 UI 힌트로만 노출. 체크박스 전체
 * 해제 + 저장 = "아무 이벤트도 보내지 않음" 과 사실상 같다.
 */
function SlackEnabledHint({ enabled }: { enabled: boolean }) {
  if (enabled) return null;
  return (
    <p className="text-muted-foreground mt-2 text-xs">
      알림 이벤트가 하나도 선택되지 않으면 Slack 발송이 일어나지 않아요.
    </p>
  );
}

function matchDatabase(
  input: string,
  databases: readonly NotionDatabase[],
): NotionDatabase | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // 정확 일치 우선 → id 포함 → 제목 포함.
  return (
    databases.find((db) => db.title === trimmed) ??
    databases.find((db) => trimmed.includes(db.id)) ??
    databases.find((db) => db.title.includes(trimmed)) ??
    null
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
