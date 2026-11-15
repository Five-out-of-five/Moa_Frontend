import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendDirectMessageAction } from "@/features/chat/direct-messages/actions";
import { getDirectConversation } from "@/features/chat/direct-messages/server";
import { MemberProfileLink } from "@/features/room/profile/MemberProfileLink";

export default async function DirectConversationPage({
  params,
}: {
  params: Promise<{ roomId: string; accountId: string }>;
}) {
  const { roomId, accountId } = await params;
  const conversation = await getDirectConversation(roomId, accountId);
  if (!conversation) notFound();
  const { member, messages } = conversation;

  return (
    <section className="bg-card rounded-card mx-auto max-w-xl space-y-4 border p-5">
      <h1 className="text-xl font-semibold">1:1 대화</h1>
      <MemberProfileLink
        roomId={roomId}
        accountId={member.accountId}
        name={member.name}
        imageUrl={member.imageUrl}
      />
      {messages.length ? (
        <ul aria-label="메시지" className="space-y-2">
          {messages.map(({ id, text }) => (
            <li key={id} className="bg-secondary rounded-md p-2 text-sm break-words">
              {text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">아직 메시지가 없습니다.</p>
      )}
      <form action={sendDirectMessageAction.bind(null, roomId, accountId)} className="flex gap-2">
        <Input
          name="message"
          aria-label="메시지"
          placeholder="메시지를 입력하세요"
          maxLength={1000}
          required
        />
        <Button>보내기</Button>
      </form>
    </section>
  );
}
