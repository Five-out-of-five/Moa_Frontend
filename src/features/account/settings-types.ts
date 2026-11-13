export interface SettingsResult {
  success: boolean;
  message: string;
  nameError?: string;
}

export const INITIAL_SETTINGS_RESULT: SettingsResult = {
  success: false,
  message: "",
};
