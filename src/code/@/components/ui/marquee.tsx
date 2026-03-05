import { cn } from "@/lib/utils";
import React, { type ComponentPropsWithoutRef } from "react";

interface MarqueeProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Optional boolean to reverse the marquee direction.
   * @default false
   */
  reverse?: boolean;

  /**
   * Optional boolean to pause the marquee animation on hover.
   * @default false
   */
  pauseOnHover?: boolean;

  /**
   * Content to be displayed in the marquee.
   */
  children: React.ReactNode;

  /**
   * Optional boolean to render the marquee vertically.
   * @default false
   */
  vertical?: boolean;

  /**
   * Number of times to repeat the children.
   * @default 4
   */
  repeat?: number;

  /**
   * Optional boolean to add a fade effect at the edges.
   * @default true
   */
  fade?: boolean;
}

export function Marquee({
  className,
  reverse,
  pauseOnHover = true,
  children,
  vertical = false,
  repeat = 4,
  fade = true,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn(
        "group flex overflow-hidden p-2 [--duration:40s] [--gap:1.5rem] [gap:var(--gap)] relative",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        fade && [
          "after:content-[''] after:absolute after:inset-0 after:z-10",
          !vertical 
            ? "after:bg-gradient-to-r after:from-background after:via-transparent after:to-background" 
            : "after:bg-gradient-to-b after:from-background after:via-transparent after:to-background"
        ],
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            aria-hidden={i > 0}
            className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
              "animate-marquee flex-row": !vertical,
              "animate-marquee-vertical flex-col": vertical,
              "group-hover:[animation-play-state:paused]": pauseOnHover,
              "[animation-direction:reverse]": reverse,
            })}
          >
            {children}
          </div>
        ))}
    </div>
  );
}
