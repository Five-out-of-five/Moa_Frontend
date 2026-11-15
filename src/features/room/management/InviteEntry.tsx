import { ArrowRight, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { InviteEntryForm } from "./InviteEntryForm";

export function InviteEntry({ invalid = false }: { invalid?: boolean }) {
  return (
    <>
      <InviteEntryForm />
      <div className="bg-card rounded-card border-border flex min-h-36 flex-col items-center justify-center gap-1 border p-5 text-center">
        <Link2 aria-hidden="true" className="text-muted-foreground mb-1 size-5" />
        {invalid ? (
          <p role="alert" className="text-destructive text-sm">
            유효한 초대 링크를 찾을 수 없어요. 링크를 다시 확인해 주세요.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm font-medium">초대 링크를 입력해 주세요.</p>
            <p className="text-muted-foreground text-xs">
              유효한 링크를 입력하면 워크스페이스 정보가 표시됩니다.
            </p>
          </>
        )}
      </div>
      <Button disabled variant="secondary" className="w-full border">
        참여 요청 보내기 <ArrowRight aria-hidden="true" />
      </Button>
    </>
  );
}
