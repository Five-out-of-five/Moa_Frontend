export interface RoomManagementResult {
  message?: string;
  success?: boolean;
  errors?: { name?: string; description?: string; image?: string; confirmation?: string };
}

export const ROOM_CREATE_LIMIT = 10;
export const ROOM_MEMBER_LIMIT = 20;
