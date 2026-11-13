import Image from "next/image";

export function MoaLogo() {
  return (
    <div className="flex justify-center">
      <Image
        src="/moa-logo-light.png"
        alt="MOA"
        width={760}
        height={240}
        className="h-8 w-auto mix-blend-multiply dark:hidden"
      />
      <Image
        src="/moa-logo-dark.png"
        alt="MOA"
        width={760}
        height={240}
        className="hidden h-8 w-auto dark:block"
      />
    </div>
  );
}
