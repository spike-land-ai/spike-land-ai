import { useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Hook to animate a number from 0 to a target value.
 * @param value The target numerical value
 * @param duration Duration of the animation in seconds
 * @returns The current animated value as a formatted string (or number)
 */
export function useAnimatedNumber(value: number, duration: number = 2) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
    duration: duration * 1000,
  });

  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return () => unsubscribe();
  }, [springValue]);

  return displayValue;
}
