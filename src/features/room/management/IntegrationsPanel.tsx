import {
  getNotionIntegration,
  listNotionDatabases,
} from "@/features/notion-integration/server";
import { getSlackIntegration } from "@/features/slack-integration/server";

import { IntegrationsForm } from "./IntegrationsForm";

/**
 * 연동 탭 Server Component — 방 설정 > 연동 쪽에서 Slack·Notion 현재 상태를 함께 선패치해
 * 하단 `IntegrationsForm` 에 props 로 내려준다. 한 쪽 조회가 실패해도 다른 섹션은 노출되도록
 * `Promise.allSettled` 로 격리하고, **실패 여부를 폼에 그대로 전달**해 "미연결" 과 구분해
 * 섹션별 에러 안내 + 재시도 UX 를 켠다 (CodeRabbit).
 */
export async function IntegrationsPanel({
  roomId,
  isOwner,
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
  const notionDatabases =
    databasesResult.status === "fulfilled" ? databasesResult.value : [];

  return (
    <IntegrationsForm
      roomId={roomId}
      isOwner={isOwner}
      initialSlack={slack}
      initialNotion={notion}
      notionDatabases={notionDatabases}
      slackLoadError={slackResult.status === "rejected"}
      notionLoadError={notionResult.status === "rejected"}
      databasesLoadError={databasesResult.status === "rejected"}
    />
  );
}
