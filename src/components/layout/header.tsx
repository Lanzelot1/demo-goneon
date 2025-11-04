import Image from "next/image";

export function Header() {
  return (
    <header className="relative z-20 bg-black/90 backdrop-blur-sm border-b border-white/10">
      <div className="container flex h-20 items-center justify-center px-6">
        <div className="flex items-center justify-center gap-6 w-full">
          <Image
            src="/logo_transparent.svg"
            alt="goNEON Logo"
            width={200}
            height={60}
            className="h-20 w-auto"
          />
          <h1 className="text-4xl font-bold tracking-tight text-white">Agentic City Planner</h1>
        </div>
      </div>
    </header>
  );
}