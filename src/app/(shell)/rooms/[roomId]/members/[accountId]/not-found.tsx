export default function MemberProfileNotFound() {
  return (
    <section className="bg-card rounded-card mx-auto max-w-sm space-y-2 border p-6">
      <h1 className="text-xl font-semibold">멤버 프로필을 찾을 수 없어요</h1>
      <p className="text-muted-foreground text-sm">
        프로필을 볼 수 있는 멤버인지 확인해 주세요.
      </p>
    </section>
  );
}
