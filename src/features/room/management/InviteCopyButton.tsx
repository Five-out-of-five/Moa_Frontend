"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function InviteCopyButton({ path }: { path: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      toast.success("초대 링크를 복사했습니다.");
    } catch {
      toast.error("링크를 복사할 수 없습니다. 표시된 링크 주소를 복사해 주세요.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      <Copy aria-hidden="true" /> 링크 복사
    </Button>
  );
}
