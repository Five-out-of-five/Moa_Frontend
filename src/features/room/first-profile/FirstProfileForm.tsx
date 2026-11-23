"use client";

import { ArrowRight, Camera, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { completeFirstRoomProfileAction } from "./actions";
import { type FirstProfileResult, PROFILE_IMAGE_TYPES } from "./types";
import { useProfileImage } from "./useProfileImage";

export function FirstProfileForm({ roomId, accountName }: { roomId: string; accountName: string }) {
  const [nickname, setNickname] = useState("");
  const { selection, imageError, isUploading, changeImage, appendImage } = useProfileImage(roomId);
  const [result, action, pending] = useActionState(
    (previous: FirstProfileResult, data: FormData) => {
      appendImage(data);
      return completeFirstRoomProfileAction(roomId, previous, data);
    },
    {},
  );
  const [skipResult, skipAction, isSkipping] = useActionState(
    async (previous: FirstProfileResult, data: FormData) => {
      if (selection && !(await changeImage())) return { message: "선택한 이미지를 취소한 뒤 다시 시도해 주세요." };
      return completeFirstRoomProfileAction(roomId, previous, data);
    },
    {},
  );
  const isPending = pending || isSkipping || isUploading;
  const visibleImageError = imageError ?? result.errors?.image;
  return (
    <>
      <form action={action} className="space-y-4">
        <fieldset disabled={isPending} className="space-y-4">
          <label className="rounded-card border-border bg-card hover:bg-secondary focus-within:bg-secondary focus-within:ring-ring/60 flex cursor-pointer items-center gap-3 border p-3 transition-colors focus-within:ring-2 has-disabled:cursor-default has-disabled:opacity-60">
            <span
              aria-hidden="true"
              className="bg-secondary text-secondary-foreground relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold"
            >
              {selection ? (
                <Image
                  src={selection.previewUrl}
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                  className="size-11 rounded-full object-cover"
                />
              ) : (
                Array.from(nickname.trim() || accountName.trim())[0]
              )}
              <span className="border-card bg-primary text-primary-foreground absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2">
                <Camera className="size-3" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">프로필 이미지 (선택)</span>
              <input
                className="sr-only"
                type="file"
                accept={PROFILE_IMAGE_TYPES.join(",")}
                aria-invalid={Boolean(visibleImageError)}
                aria-describedby={
                  visibleImageError
                    ? "first-profile-image-hint first-profile-image-error"
                    : "first-profile-image-hint"
                }
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void changeImage(file);
                }}
              />
              <span
                id="first-profile-image-hint"
                className="text-muted-foreground mt-1 block text-xs"
              >
                {isUploading ? "이미지 처리 중…" : selection ? "눌러서 이미지 변경" : "선택 사항이며 나중에도 변경할 수 있어요."}
              </span>
              {selection ? (
                <span
                  className="text-muted-foreground mt-1 block truncate text-xs"
                  title={selection.file.name}
                >
                  {selection.file.name}
                </span>
              ) : null}
            </span>
          </label>
          {selection && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void changeImage()}>
              선택한 이미지 취소
            </Button>
          )}
          {visibleImageError && (
            <p id="first-profile-image-error" role="alert" className="text-destructive text-sm">
              {visibleImageError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="first-profile-nickname">닉네임 (선택)</Label>
            <Input
              id="first-profile-nickname"
              name="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={20}
              placeholder={accountName}
              aria-invalid={Boolean(result.errors?.nickname)}
              aria-describedby="first-profile-nickname-hint"
            />
            <p id="first-profile-nickname-hint" className="text-muted-foreground text-xs">
              {result.errors?.nickname ? (
                <span role="alert" className="text-destructive">
                  {result.errors.nickname}
                </span>
              ) : (
                "비워 두면 계정의 기본 이름을 사용합니다."
              )}
            </p>
          </div>
        </fieldset>
        <p className="bg-secondary text-secondary-foreground flex items-center gap-2 rounded-md p-3 text-xs">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          개인 계정 정보와 별도로 관리됩니다.
        </p>
        <SaveButton disabled={isPending} />
        {(result.message || skipResult.message) && (
          <p role="alert" className="text-destructive text-sm">{result.message ?? skipResult.message}</p>
        )}
      </form>
      <form action={skipAction} className="mt-2 text-center">
        <input type="hidden" name="intent" value="skip" />
        <Button variant="ghost" disabled={isPending}>
          건너뛰기
        </Button>
      </form>
    </>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={disabled || pending} className="w-full">
      {pending ? "저장 중…" : "워크스페이스 시작하기"}
      {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
    </Button>
  );
}
