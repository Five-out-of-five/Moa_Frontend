import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NoticeNotFound() {
  return <div className="bg-card border-border rounded-card mx-auto max-w-4xl space-y-3 border p-5">
    <h1 className="text-lg font-semibold">공지를 찾을 수 없어요.</h1>
    <Button variant="outline" asChild><Link href="/notices">공지사항 목록</Link></Button>
  </div>;
}
