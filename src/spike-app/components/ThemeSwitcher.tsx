import type { ReactNode } from "react";
import type { ThemePreference } from "@/hooks/useDarkMode";
import { Monitor, Sun, Moon } from "lucide-react";

interface ThemeSwitcherProps {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}

const options: { value: ThemePreference; label: string; Icon: (props: { className?: string }) => ReactNode }[] = [
  { value: "system", label: "System", Icon: (props) => <Monitor {...props} /> },
  { value: "light", label: "Light", Icon: (props) => <Sun {...props} /> },
  { value: "dark", label: "Dark", Icon: (props) => <Moon {...props} /> },
];

export function ThemeSwitcher({ theme, setTheme }: ThemeSwitcherProps) {
  return (
    <div className="rounded-lg p-0.5 flex gap-0.5 bg-muted" role="group" aria-label="Theme preference">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          title={`${label} mode`}
          onClick={() => setTheme(value)}
          className={[
            "rounded-md p-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            theme === value
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50",
          ].join(" ")}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
