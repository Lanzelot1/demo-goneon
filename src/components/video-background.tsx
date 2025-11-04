"use client";

interface VideoBackgroundProps {
  videoUrl?: string;
}

export function VideoBackground({ videoUrl = "/4082143-uhd_3840_2160_24fps.mp4" }: VideoBackgroundProps) {
  return (
    <div className="absolute inset-0 z-0">
      {/* Fallback gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />

      {/* Video element - would work if video file exists */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        onError={(e) => {
          // Hide video on error and show gradient background
          e.currentTarget.style.display = 'none';
        }}
      >
        <source src={videoUrl} type="video/mp4" />
      </video>

      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}