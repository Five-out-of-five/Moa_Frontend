import { NotificationSettingsForm } from "@/features/account/components/SettingsForms";
import { getGlobalNotificationPreferences } from "@/features/notification/server";
import { getToneMode } from "@/features/tone/server";
import { ToneSettingsForm } from "@/features/tone/ToneSettingsForm";

export default async function AccountNotificationSettingsPage() {
  const [preferences, toneMode] = await Promise.all([getGlobalNotificationPreferences(), getToneMode().catch(() => null)]);

  return (
    <div className="min-w-0 space-y-5">
    <section className="bg-card rounded-xl border p-5">
      <h2 className="font-semibold">톤앤매너 순화</h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">카드와 방 채팅에서 직접 검토를 요청할 때 적용돼요. 원문을 자동으로 바꾸거나 전송하지 않아요.</p>
      {toneMode ? <ToneSettingsForm mode={toneMode} /> : <p role="alert" className="text-destructive text-sm">순화 설정을 불러오지 못했어요. 새로고침해 주세요.</p>}
    </section>
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
    </div>
  );
}
