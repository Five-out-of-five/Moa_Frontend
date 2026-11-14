export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface FirstProfileResult {
  errors?: { nickname?: string; image?: string };
}

export interface FirstRoomProfile {
  nickname: string | null;
  imageUrl: string | null;
  position?: string | null;
}
