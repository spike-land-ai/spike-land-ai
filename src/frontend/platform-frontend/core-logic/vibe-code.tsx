import { VibeCoder } from "../ui/components/VibeCoder";

export function VibeCodePage() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <h1 className="sr-only">Vibe Coder</h1>
      <VibeCoder />
    </div>
  );
}
