import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        heading: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "drop-zone-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "grid-fade-out": {
          from: { opacity: "1", filter: "blur(0px)" },
          to: { opacity: "0.3", filter: "blur(4px)" },
        },
        "grid-fade-in": {
          from: { opacity: "0.3", filter: "blur(4px)" },
          to: { opacity: "1", filter: "blur(0px)" },
        },
        "hero-expand": {
          "0%": {
            transform: "translate(var(--hero-x), var(--hero-y)) scale(var(--hero-scale))",
            borderRadius: "0.75rem",
          },
          "100%": { transform: "translate(0, 0) scale(1)", borderRadius: "0" },
        },
        "hero-collapse": {
          "0%": { transform: "translate(0, 0) scale(1)", borderRadius: "0" },
          "100%": {
            transform: "translate(var(--hero-x), var(--hero-y)) scale(var(--hero-scale))",
            borderRadius: "0.75rem",
          },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(34, 197, 94, 0.4)" },
          "50%": { boxShadow: "0 0 30px rgba(34, 197, 94, 0.6)" },
        },
        "float-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "border-flow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "drop-zone-bounce": "drop-zone-bounce 1s ease-in-out infinite",
        "grid-fade-out": "grid-fade-out 0.3s ease-out forwards",
        "grid-fade-in": "grid-fade-in 0.3s ease-out forwards",
        "hero-expand": "hero-expand 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "hero-collapse": "hero-collapse 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float-up": "float-up 0.3s ease-out forwards",
        "spin-slow": "spin-slow 8s linear infinite",
        float: "float 3s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
        "border-flow": "border-flow 3s ease infinite",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "slide-in-right": "slide-in-right 0.4s ease-out forwards",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        aurora: {
          green: "hsl(var(--aurora-green))",
          teal: "hsl(var(--aurora-teal))",
          lime: "hsl(var(--aurora-lime))",
          yellow: "hsl(var(--aurora-yellow))",
        },
      },
      textColor: {
        primary: "hsl(var(--primary-text))",
        accent: "hsl(var(--accent))",
      },
    },
  },
  plugins: [],
} satisfies Config;
