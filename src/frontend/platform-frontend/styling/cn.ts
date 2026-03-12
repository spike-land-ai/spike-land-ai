import { twMerge } from "tailwind-merge";

type ClassValue = string | number | boolean | null | undefined | ClassValue[];

function clsx(...inputs: ClassValue[]): string {
  return (inputs as unknown[]).flat(Infinity).filter(Boolean).join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}
