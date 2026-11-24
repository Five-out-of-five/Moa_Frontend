"use client";

import { type ReactElement, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Room } from "@/types/db";

import { saveManagedRoomAction } from "./actions";

export function RoomFormDialog({
  room,
  initiallyOpen = false,
  trigger,
}: {
  room?: Pick<Room, "id" | "name" | "description" | "imageUrl">;
  initiallyOpen?: boolean;
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [name, setName] = useState(room?.name ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [result, action, pending] = useActionState(
    async (previous: Awaited<ReturnType<typeof saveManagedRoomAction>>, data: FormData) => {
      if (room && name === room.name) data.delete("name");
      if (room && description === (room.description ?? "")) data.delete("description");
      const response = await saveManagedRoomAction(room?.id ?? null, previous, data);
      if (response.success) setOpen(false);
      return response;
    },
    {},
  );
  useEffect(() => {
    if (!result.message) return;
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
  }, [result]);

  const title = room ? "워크스페이스 정보 수정" : "새 워크스페이스 만들기";

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={room ? "outline" : "default"}>
            {room ? "정보 수정" : "새 워크스페이스"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>팀을 구분하기 쉬운 이름과 설명을 입력하세요.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <fieldset disabled={pending} className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="workspace-name">워크스페이스 이름</Label>
              <Input
                id="workspace-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={30}
                aria-invalid={Boolean(result.errors?.name)}
              />
              {result.errors?.name && (
                <p role="alert" className="text-destructive text-sm">
                  {result.errors.name}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workspace-description">설명</Label>
              <Textarea
                id="workspace-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={200}
                aria-invalid={Boolean(result.errors?.description)}
              />
              {result.errors?.description && (
                <p role="alert" className="text-destructive text-sm">
                  {result.errors.description}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workspace-image">대표 이미지</Label>
              <Input
                id="workspace-image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-invalid={Boolean(result.errors?.image)}
              />
              {room?.imageUrl && (
                <label className="flex gap-2 text-sm">
                  <input name="removeImage" type="checkbox" />
                  기존 이미지 삭제
                </label>
              )}
              <p className="text-muted-foreground text-xs">JPG, PNG, WebP · 최대 5MB</p>
              {result.errors?.image && (
                <p role="alert" className="text-destructive text-sm">
                  {result.errors.image}
                </p>
              )}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              닫기
            </Button>
            <Button disabled={pending}>
              {pending ? "저장 중…" : room ? "변경 사항 저장" : "워크스페이스 만들기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
