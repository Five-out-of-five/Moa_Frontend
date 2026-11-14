import {
  LeaveWorkspaceDialog,
  WithdrawalDialog,
} from "@/features/account/components/AccountDialogs";
import { AccountNameForm } from "@/features/account/components/SettingsForms";
import { getMyAccount } from "@/features/account/server";
import { listMyRoomsForSettings } from "@/features/room/server";

const PROVIDER_LABEL = { GOOGLE: "구글", KAKAO: "카카오", NAVER: "네이버" };

export default async function AccountPage() {
  const [account, rooms] = await Promise.all([getMyAccount(), listMyRoomsForSettings()]);

  return (
    <div className="min-w-0 space-y-4">
      <section className="bg-card rounded-xl border p-5">
        <h2 className="font-semibold">기본 프로필</h2>
        <p className="text-muted-foreground mt-1 mb-5 text-sm">
          방별 닉네임을 설정하지 않은 워크스페이스에서 사용하는 이름입니다.
        </p>
        <AccountNameForm name={account.name} />
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <dt className="text-muted-foreground text-xs">연결된 소셜 계정</dt>
            <dd className="mt-1 text-sm">{PROVIDER_LABEL[account.provider]}</dd>
          </div>
          <div className="min-w-0 rounded-md border p-3">
            <dt className="text-muted-foreground text-xs">이메일</dt>
            <dd className="mt-1 text-sm break-all">{account.email}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-card rounded-xl border p-5">
        <h2 className="font-semibold">참여 중인 워크스페이스</h2>
        {rooms.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">참여 중인 워크스페이스가 없습니다.</p>
        ) : (
          <ul className="divide-border mt-3 divide-y">
            {rooms.map((room) => (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{room.name}</p>
                  {room.isOwner !== null && (
                    <p className="text-muted-foreground text-xs">
                      {room.isOwner ? "방장" : "멤버"}
                    </p>
                  )}
                </div>
                {room.isOwner ? (
                  <p className="text-muted-foreground text-xs">
                    방장 권한을 위임한 후 나갈 수 있습니다.
                  </p>
                ) : room.isOwner === false ? (
                  <LeaveWorkspaceDialog id={room.id} name={room.name} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5">
        <h2 className="text-destructive font-semibold">계정 탈퇴</h2>
        <WithdrawalDialog hasOwnedRooms={rooms.some((room) => room.isOwner)} />
      </section>
    </div>
  );
}
