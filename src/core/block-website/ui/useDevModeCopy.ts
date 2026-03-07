import { useEffect, useMemo, useRef, useState } from "react";
import { useDevMode, useDevModeTransition } from "../core-logic/dev-mode";

const SCRAMBLE_CHARS = "01<>/=+*{}[]:;ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function scrambleString(length: number, seed: number) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SCRAMBLE_CHARS[(seed + i * 7) % SCRAMBLE_CHARS.length];
  }
  return out;
}

export function useDevModeCopy(defaultText: string, developerText: string) {
  const { isDeveloper } = useDevMode();
  const { isTransitioning, durationMs, startedAt } = useDevModeTransition();
  const targetText = isDeveloper ? developerText : defaultText;
  const previousTextRef = useRef(targetText);
  const [displayText, setDisplayText] = useState(targetText);

  useEffect(() => {
    if (!isTransitioning || startedAt == null) {
      previousTextRef.current = targetText;
      setDisplayText(targetText);
      return;
    }

    const fromText = previousTextRef.current;
    let frameId = 0;

    const render = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / durationMs, 1);
      const eraseProgress = Math.min(progress / 0.45, 1);
      const typeProgress = progress <= 0.45 ? 0 : Math.min((progress - 0.45) / 0.55, 1);

      const keepCount = Math.round(fromText.length * (1 - eraseProgress));
      const typedCount = Math.round(targetText.length * typeProgress);

      if (progress < 0.45) {
        const visible = fromText.slice(0, keepCount);
        const noise = scrambleString(
          Math.max(0, Math.min(6, fromText.length - keepCount)),
          typedCount + keepCount,
        );
        setDisplayText(`${visible}${noise}`);
      } else {
        const visible = targetText.slice(0, typedCount);
        const noise =
          typedCount < targetText.length
            ? scrambleString(Math.min(4, targetText.length - typedCount), keepCount + typedCount)
            : "";
        setDisplayText(`${visible}${noise}`);
      }

      if (progress < 1) {
        frameId = window.requestAnimationFrame(render);
      } else {
        previousTextRef.current = targetText;
        setDisplayText(targetText);
      }
    };

    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [durationMs, isTransitioning, startedAt, targetText]);

  return useMemo(
    () => ({
      text: displayText,
      isDeveloper,
      isTransitioning,
    }),
    [displayText, isDeveloper, isTransitioning],
  );
}
