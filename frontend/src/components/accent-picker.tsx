// frontend/src/components/accent-picker.tsx
import * as React from "react";

export type AccentColor = "red" | "orange" | "yellow" | "green" | "blue" | "pink" | "white";

interface AccentDef {
  label: AccentColor;
  swatch: string;
  dark: { primary: string; accent: string; accentFg: string; secondary: string; secondaryFg: string };
  light: { primary: string; accent: string; accentFg: string; secondary: string; secondaryFg: string };
}

const ACCENTS: AccentDef[] = [
  {
    label: "red",
    swatch: "oklch(0.65 0.28 25)",
    dark:  { primary: "oklch(0.65 0.28 25)",  accent: "oklch(0.22 0.08 25)",  accentFg: "oklch(0.85 0.14 25)",  secondary: "oklch(0.22 0.06 25)",  secondaryFg: "oklch(0.92 0 0)" },
    light: { primary: "oklch(0.45 0.22 25)",  accent: "oklch(0.91 0.05 25)",  accentFg: "oklch(0.22 0.12 25)",  secondary: "oklch(0.92 0.04 25)",  secondaryFg: "oklch(0.22 0.1 25)" },
  },
  {
    label: "orange",
    swatch: "oklch(0.72 0.22 50)",
    dark:  { primary: "oklch(0.72 0.22 50)",  accent: "oklch(0.22 0.07 50)",  accentFg: "oklch(0.85 0.14 50)",  secondary: "oklch(0.22 0.06 50)",  secondaryFg: "oklch(0.92 0 0)" },
    light: { primary: "oklch(0.48 0.18 50)",  accent: "oklch(0.91 0.05 50)",  accentFg: "oklch(0.22 0.12 50)",  secondary: "oklch(0.92 0.04 50)",  secondaryFg: "oklch(0.22 0.1 50)" },
  },
  {
    label: "yellow",
    swatch: "oklch(0.85 0.20 95)",
    dark:  { primary: "oklch(0.85 0.20 95)",  accent: "oklch(0.24 0.07 95)",  accentFg: "oklch(0.90 0.15 95)",  secondary: "oklch(0.23 0.06 95)",  secondaryFg: "oklch(0.92 0 0)" },
    light: { primary: "oklch(0.52 0.16 95)",  accent: "oklch(0.93 0.05 95)",  accentFg: "oklch(0.22 0.12 95)",  secondary: "oklch(0.93 0.04 95)",  secondaryFg: "oklch(0.22 0.1 95)" },
  },
  {
    label: "green",
    swatch: "oklch(0.75 0.22 142)",
    dark:  { primary: "oklch(0.75 0.22 142)", accent: "oklch(0.22 0.07 142)", accentFg: "oklch(0.85 0.14 142)", secondary: "oklch(0.22 0.06 142)", secondaryFg: "oklch(0.92 0 0)" },
    light: { primary: "oklch(0.45 0.18 142)", accent: "oklch(0.91 0.05 142)", accentFg: "oklch(0.22 0.12 142)", secondary: "oklch(0.92 0.04 142)", secondaryFg: "oklch(0.22 0.1 142)" },
  },
  {
    label: "blue",
    swatch: "oklch(0.65 0.25 260)",
    dark:  { primary: "oklch(0.65 0.25 260)", accent: "oklch(0.21 0.08 260)", accentFg: "oklch(0.85 0.12 260)", secondary: "oklch(0.20 0.07 260)", secondaryFg: "oklch(0.90 0 0)" },
    light: { primary: "oklch(0.40 0.18 260)", accent: "oklch(0.91 0.05 260)", accentFg: "oklch(0.22 0.12 260)", secondary: "oklch(0.92 0.03 260)", secondaryFg: "oklch(0.22 0.1 260)" },
  },
  {
    label: "pink",
    swatch: "oklch(0.72 0.25 340)",
    dark:  { primary: "oklch(0.72 0.25 340)", accent: "oklch(0.22 0.08 340)", accentFg: "oklch(0.85 0.14 340)", secondary: "oklch(0.22 0.06 340)", secondaryFg: "oklch(0.92 0 0)" },
    light: { primary: "oklch(0.46 0.20 340)", accent: "oklch(0.91 0.05 340)", accentFg: "oklch(0.22 0.12 340)", secondary: "oklch(0.92 0.04 340)", secondaryFg: "oklch(0.22 0.1 340)" },
  },
  {
    label: "white",
    swatch: "oklch(0.95 0 0)",
    dark:  { primary: "oklch(0.95 0 0)",      accent: "oklch(0.26 0 0)",      accentFg: "oklch(0.90 0 0)",      secondary: "oklch(0.24 0 0)",      secondaryFg: "oklch(0.92 0 0)" },
    light: { primary: "oklch(0.35 0 0)",      accent: "oklch(0.90 0 0)",      accentFg: "oklch(0.20 0 0)",      secondary: "oklch(0.88 0 0)",      secondaryFg: "oklch(0.20 0 0)" },
  },
];

const STYLE_ID = "ht-accent-override";

export function applyAccent(color: AccentColor, isDark: boolean) {
  const def = ACCENTS.find((a) => a.label === color);
  if (!def) return;
  const v = isDark ? def.dark : def.light;

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }

  const scope = isDark ? ".dark" : ":root";
  const glowVars = isDark
    ? `  --glow-color: color-mix(in srgb, ${v.primary} 8%, transparent);
  --glow-color-soft: color-mix(in srgb, ${v.primary} 6%, transparent);`
    : "";
  // Light accents in dark mode (white, green, yellow) need dark text on primary-colored surfaces.
  const lightAccentsInDark = isDark && (color === "white" || color === "green" || color === "yellow");
  const primaryFg = lightAccentsInDark ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";
  el.textContent = `
${scope} {
  --primary: ${v.primary};
  --primary-foreground: ${primaryFg};
  --ring: ${v.primary};
  --accent: ${v.accent};
  --accent-foreground: ${v.accentFg};
  --secondary: ${v.secondary};
  --secondary-foreground: ${v.secondaryFg};
  --sidebar-primary: ${v.primary};
  --sidebar-ring: ${v.primary};
  --sidebar-accent: ${v.accent};
  --sidebar-accent-foreground: ${v.accentFg};
  --chart-1: ${v.primary};
${glowVars}
}
  `.trim();
}

interface AccentPickerProps {
  isDark: boolean;
}

export function AccentPicker({ isDark }: AccentPickerProps) {
  const [accent, setAccent] = React.useState<AccentColor>(() => {
    return (localStorage.getItem("ht-accent") as AccentColor | null) ?? "green";
  });

  React.useEffect(() => {
    applyAccent(accent, isDark);
  }, [accent, isDark]);

  function handleSelect(color: AccentColor) {
    setAccent(color);
    localStorage.setItem("ht-accent", color);
    applyAccent(color, isDark);
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Accent color">
      {ACCENTS.map((a) => (
        <button
          key={a.label}
          aria-label={a.label}
          onClick={() => handleSelect(a.label)}
          className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            backgroundColor: a.swatch,
            borderColor: accent === a.label ? "white" : "transparent",
          }}
          title={a.label.charAt(0).toUpperCase() + a.label.slice(1)}
        />
      ))}
    </div>
  );
}
