import {
  getNotionIntegration,
  listNotionDatabases,
} from "@/features/notion-integration/server";
import { getSlackIntegration } from "@/features/slack-integration/server";

import { IntegrationsForm } from "./IntegrationsForm";

/**
 * 연동 탭 Server Component — 방 설정 > 연동 쪽에서 Slack·Notion 현재 상태를 함께 선패치해
 * 하단 `IntegrationsForm` 에 props 로 내려준다. 한 쪽 조회가 실패해도 다른 섹션은 노출되도록
 * `Promise.allSettled` 로 격리.
 *
 * ⚠️ 비방장 멤버도 연동 탭을 볼 수는 있으나 저장·OAuth 는 BE 가 거절한다. 현재 `isOwner` 는
 *    사용 안 하고 Form 안에서 버튼 UX 로 처리한다 (BE 가 최종 권한자).
 */
export async function IntegrationsPanel({
  roomId,
}: {
  roomId: number;
  isOwner: boolean;
}) {
  const [slackResult, notionResult, databasesResult] = await Promise.allSettled([
    getSlackIntegration(roomId),
    getNotionIntegration(roomId),
    listNotionDatabases(roomId),
  ]);

  const slack = slackResult.status === "fulfilled" ? slackResult.value : null;
  const notion = notionResult.status === "fulfilled" ? notionResult.value : null;
  // DB 목록은 OAuth 전이면 BE 가 거절할 수 있다 — 조용히 빈 배열.
  const notionDatabases =
    databasesResult.status === "fulfilled" ? databasesResult.value : [];

  return (
    <IntegrationsForm
      roomId={roomId}
      initialSlack={slack}
      initialNotion={notion}
      notionDatabases={notionDatabases}
    />
  );
}
