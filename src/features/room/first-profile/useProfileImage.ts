"use client";

import { useState } from "react";

import { discardProfileImageAction, uploadProfileImageAction } from "./image-actions";
import { PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_TYPES } from "./types";

interface Selection {
  file: File;
  fileId?: number;
  previewUrl: string;
}

export function useProfileImage(roomId: string) {
  const [selection, setSelection] = useState<Selection>();
  const [imageError, setImageError] = useState<string>();
  const [isUploading, setIsUploading] = useState(false);

  async function changeImage(file?: File) {
    if (file && (!file.size || file.size > PROFILE_IMAGE_MAX_BYTES || !PROFILE_IMAGE_TYPES.some((type) => type === file.type))) {
      setImageError("JPG, PNG, WebP 형식의 5MB 이하 이미지를 선택해 주세요.");
      return false;
    }
    setImageError(undefined);
    setIsUploading(true);
    try {
      if (selection?.fileId) {
        const discarded = await discardProfileImageAction(roomId, selection.fileId);
        if (discarded.error) {
          setImageError(discarded.error);
          return false;
        }
      }
      setSelection(undefined);
      if (!file) return true;
      const form = new FormData();
      form.set("file", file);
      const result = await uploadProfileImageAction(roomId, form);
      if (!result.previewUrl) {
        setImageError(result.error ?? "이미지 미리보기를 불러오지 못했습니다.");
        return false;
      }
      setSelection({ file, fileId: result.fileId, previewUrl: result.previewUrl });
      return true;
    } catch {
      setImageError("이미지를 처리하지 못했습니다. 다시 시도해 주세요.");
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  function appendImage(form: FormData) {
    if (selection?.fileId) form.set("fileId", String(selection.fileId));
    else if (selection) form.set("image", selection.file);
  }

  return { selection, imageError, isUploading, changeImage, appendImage, resetImage: () => setSelection(undefined) };
}
