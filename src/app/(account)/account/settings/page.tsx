import { NotificationSettingsForm } from "@/features/account/components/SettingsForms";
import { getGlobalNotificationPreferences } from "@/features/notification/server";

export default async function AccountNotificationSettingsPage() {
  const preferences = await getGlobalNotificationPreferences();

  return (
    <section className="bg-card min-w-0 self-start rounded-xl border p-5">
      <h2 className="font-semibold">전역 알림 설정</h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">
        방별 설정이 없는 워크스페이스에 적용할 기본 알림을 선택하세요.
      </p>
      {preferences ? (
        <NotificationSettingsForm preferences={preferences} />
      ) : (
        <p className="text-muted-foreground text-sm">
          현재 환경에서는 알림 설정을 불러올 수 없습니다.
        </p>
      )}
    </section>
  );
}
