import Image from "next/image";

export function Header() {
  return (
    <header className="relative z-20 bg-black/90 backdrop-blur-sm border-b border-white/10">
      <div className="flex h-20 items-center justify-center">
        <Image
          src="/logo_transparent.svg"
          alt="goNEON Logo"
          width={200}
          height={60}
          className="h-20 w-auto"
        />
      </div>
    </header>
  );
}