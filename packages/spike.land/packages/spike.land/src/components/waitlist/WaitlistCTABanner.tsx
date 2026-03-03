"use client";

import { WaitlistInlineForm } from "./WaitlistInlineForm";

interface WaitlistCTABannerProps {
  variant: "hero" | "inline";
}

export function WaitlistCTABanner({ variant }: WaitlistCTABannerProps) {
  if (variant === "hero") {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
        <h3 className="text-lg font-semibold text-white">
          Join the waiting list
        </h3>
        <p className="text-sm text-zinc-400">
          Get early access when we launch.
        </p>
        <WaitlistInlineForm source="hero" className="w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-400">
        Join the waiting list for early access
      </p>
      <WaitlistInlineForm source="inline" className="max-w-sm" />
    </div>
  );
}
