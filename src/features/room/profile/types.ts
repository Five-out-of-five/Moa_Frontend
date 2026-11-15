export interface RoomProfileResult {
  success?: boolean;
  message?: string;
  errors?: { nickname?: string; position?: string; image?: string };
}

export interface RoomProfileSummary {
  roomId: number;
  name: string;
  imageUrl: string | null;
  position: string | null;
}
