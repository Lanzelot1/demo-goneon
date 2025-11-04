"use client";

import { Particles } from "@/components/ui/particles";

interface FloatingParticlesProps {
  className?: string;
}

export function FloatingParticles({ className }: FloatingParticlesProps) {
  return (
    <>
      {/* Pink/Purple Bubbles */}
      <Particles
        className={className}
        quantity={25}
        staticity={50}
        ease={80}
        size={4}
        color="#e9308f"
        vy={-0.5}
        refresh={false}
      />

      {/* Blue/Cyan Bubbles */}
      <Particles
        className={className}
        quantity={25}
        staticity={50}
        ease={80}
        size={4}
        color="#11e0f0"
        vy={-0.5}
        refresh={false}
      />
    </>
  );
}
