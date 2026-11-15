import Image from "next/image";
import Link from "next/link";

export function MemberProfileLink({
  roomId,
  accountId,
  name,
  imageUrl,
}: {
  roomId: string | number;
  accountId: number;
  name: string;
  imageUrl?: string | null;
}) {
  return (
    <Link
      href={`/rooms/${roomId}/members/${accountId}`}
      className="hover:bg-secondary focus-visible:ring-ring inline-flex max-w-full items-center gap-2 rounded-md p-1 text-sm focus-visible:ring-2"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={28}
          height={28}
          unoptimized
          className="size-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-secondary text-secondary-foreground grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
        >
          {Array.from(name)[0]}
        </span>
      )}
      <span className="truncate">{name}</span>
    </Link>
  );
}
