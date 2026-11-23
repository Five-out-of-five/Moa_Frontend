"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PROFILE_IMAGE_TYPES } from "../first-profile/types";
import { useProfileImage } from "../first-profile/useProfileImage";
import { updateRoomProfileAction } from "./actions";
import type { RoomProfileResult } from "./types";

interface Props {
  roomId: string;
  accountName: string;
  nickname: string;
  position: string;
  imageUrl: string | null;
}

export function RoomProfileForm({ roomId, accountName, nickname, position, imageUrl }: Props) {
  const { selection, imageError, isUploading, changeImage, appendImage, resetImage } = useProfileImage(roomId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [shouldRemoveImage, setShouldRemoveImage] = useState(false);
  const [result, action, pending] = useActionState(
    async (previous: RoomProfileResult, data: FormData) => {
      appendImage(data);
      if (name === nickname) data.delete("nickname");
      if (jobTitle === position) data.delete("position");
      if (shouldRemoveImage) data.set("removeImage", "on");
      const next = await updateRoomProfileAction(roomId, previous, data);
      if (next.success) {
        resetImage();
        if (fileInput.current) fileInput.current.value = "";
        setShouldRemoveImage(false);
      }
      return next;
    },
    {},
  );
  const [name, setName] = useState(nickname);
  const [jobTitle, setJobTitle] = useState(position);

  useEffect(() => {
    if (!result.message) return;
    if (result.success) toast.success(result.message);
    else toast.error(result.message);
  }, [result]);

  return (
    <form action={action} className="space-y-5">
      <fieldset disabled={pending || isUploading} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="room-profile-nickname">닉네임</Label>
          <Input
            id="room-profile-nickname"
            name="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            placeholder={accountName}
            aria-invalid={Boolean(result.errors?.nickname)}
            aria-describedby="room-profile-nickname-hint"
          />
          <p
            id="room-profile-nickname-hint"
            className={
              result.errors?.nickname ? "text-destructive text-sm" : "text-muted-foreground text-sm"
            }
          >
            {result.errors?.nickname ?? "비워 두면 계정의 기본 이름을 사용합니다."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="room-profile-position">직책</Label>
          <Input
            id="room-profile-position"
            name="position"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            maxLength={20}
            placeholder="예: 디자인"
            aria-invalid={Boolean(result.errors?.position)}
            aria-describedby={result.errors?.position ? "room-profile-position-error" : undefined}
          />
          {result.errors?.position && (
            <p id="room-profile-position-error" className="text-destructive text-sm">
              {result.errors.position}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="room-profile-image">프로필 이미지</Label>
          {(selection?.previewUrl || (!shouldRemoveImage && imageUrl)) && (
            <Image
              src={selection?.previewUrl ?? imageUrl ?? ""}
              alt="프로필 이미지 미리보기"
              width={48}
              height={48}
              unoptimized
              className="size-12 rounded-full object-cover"
            />
          )}
          <Input
            id="room-profile-image"
            ref={fileInput}
            type="file"
            accept={PROFILE_IMAGE_TYPES.join(",")}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void changeImage(file).then((selected) => {
                if (selected) setShouldRemoveImage(false);
                if (fileInput.current) fileInput.current.value = "";
              });
            }}
            aria-invalid={Boolean(imageError || result.errors?.image)}
            aria-describedby="room-profile-image-hint"
          />
          <p
            id="room-profile-image-hint"
            className={
              imageError || result.errors?.image ? "text-destructive text-sm" : "text-muted-foreground text-sm"
            }
          >
            {isUploading ? "이미지 처리 중…" : imageError ?? result.errors?.image ?? selection?.file.name ?? "JPG, PNG, WebP · 최대 5MB"}
          </p>
          {selection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void changeImage();
              }}
            >
              선택한 이미지 취소
            </Button>
          )}
          {imageUrl && !selection && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="removeImage"
                checked={shouldRemoveImage}
                onChange={(event) => setShouldRemoveImage(event.currentTarget.checked)}
              />
              현재 이미지 삭제
            </label>
          )}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button disabled={pending || isUploading}>{pending ? "저장 중…" : "변경 사항 저장"}</Button>
      </div>
    </form>
  );
}
