import { unstable_rethrow } from "next/navigation";

import type { BoardSession } from "@/types/db";

import { MeetingSummaryDialog } from "./MeetingSummaryDialog";
import { getMeetingSummaries } from "./server";

export async function MeetingSummaryLoader(props: {
  roomId: number; history: BoardSession[]; hasActive: boolean; accountId: number;
  visibleCards: { id: number; title: string }[];
}) {
  try {
    const recent = await getMeetingSummaries(props.roomId);
    return <MeetingSummaryDialog {...props} recent={recent} />;
  } catch (error) {
    unstable_rethrow(error);
    return <MeetingSummaryDialog {...props} recent={[]} recentError="최근 요약을 불러오지 못했어요." />;
  }
}
