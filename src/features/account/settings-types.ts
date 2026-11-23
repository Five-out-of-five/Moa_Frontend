export interface SettingsResult {
  name?: string;
  success: boolean;
  message: string;
  nameError?: string;
}

export const INITIAL_SETTINGS_RESULT: SettingsResult = {
  success: false,
  message: "",
};
export interface WithdrawalResult {
  message?: string;
  confirmError?: string;
  check?: {
    withdrawable: boolean;
    canWithdraw: boolean;
    ownedRooms: { roomId?: number; name?: string; memberCount?: number }[];
  };
}
