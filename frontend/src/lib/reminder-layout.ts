// frontend/src/lib/reminder-layout.ts
// Pure layout logic for the Daily Reminders sheet. No React, no fetch —
// everything here is unit-testable in isolation.
import type { Medication } from "../api/medications";
import type { NutritionUnacceptableFood } from "../api/nutritionPlan";

export type ThemeKey = "morning" | "midday" | "evening" | "asneeded" | "custom";

export interface CustomTheme {
  bg: string;
  border: string;
  title: string;
}

export interface ReminderMed {
  emoji: string;
  name: string;
  desc: string;
  badge: string;
}

export interface ReminderSection {
  emoji: string;
  name: string;
  when: string;
  theme: ThemeKey;
  customTheme: CustomTheme | null;
  visible: boolean;
  meds: ReminderMed[];
}

export interface ReminderItem {
  emoji: string;
  title: string;
  desc: string;
}

export interface AvoidItem {
  emoji: string;
  text: string;
}

export interface ReminderLayout {
  headerEmoji: string;
  title: string;
  subtitle: string;
  sidebarHead: string;
  showSidebar: boolean;
  showAvoid: boolean;
  showUpdated: boolean;
  updated: string;
  reminders: ReminderItem[];
  sections: ReminderSection[];
  avoid: AvoidItem[];
  notes: string;
}

/** Hex values ported verbatim from the source one-pager's `themes` object. */
export const THEMES: Record<Exclude<ThemeKey, "custom">, CustomTheme> = {
  morning: { bg: "#FFFBEC", border: "#E8A000", title: "#7A5000" },
  midday: { bg: "#EDFAF4", border: "#239a63", title: "#145F3A" },
  evening: { bg: "#EEF0FB", border: "#5461cc", title: "#3440A0" },
  asneeded: { bg: "#FEF2F2", border: "#D93535", title: "#A31E1E" },
};

// Sample content is deliberately generic (over-the-counter meds and vitamins) —
// this ships in a public repo, so it must not describe any real person's regimen.
// Must stay in sync with backend/app/services/reminder_defaults.py.
const DEFAULT_LAYOUT: ReminderLayout = {
  headerEmoji: "💊",
  title: "MY DAILY MEDICATIONS",
  subtitle: "A reminder of what to take and when",
  sidebarHead: "📋 DAILY REMINDERS",
  showSidebar: true,
  showAvoid: true,
  showUpdated: true,
  updated: "",
  reminders: [
    { emoji: "🍽️", title: "Eat", desc: "Small meals multiple times per day" },
    { emoji: "💧", title: "Hydrate", desc: "Water or electrolyte drinks" },
    { emoji: "🚶", title: "Move", desc: "A short walk when you can" },
  ],
  sections: [
    {
      emoji: "☀️", name: "MORNING", when: "Take in the morning", theme: "morning",
      customTheme: null, visible: true,
      meds: [
        { emoji: "🌈", name: "Multivitamin", desc: "Daily vitamin · 1 tablet · Once a day", badge: "" },
        { emoji: "💊", name: "Aspirin", desc: "Low dose · 1 tablet · Once a day", badge: "" },
      ],
    },
    {
      emoji: "🌤️", name: "MIDDAY", when: "Take around lunchtime", theme: "midday",
      customTheme: null, visible: true,
      meds: [
        { emoji: "🌼", name: "Zyrtec", desc: "Allergy medicine · 1 tablet · Once a day", badge: "" },
        { emoji: "🦴", name: "Calcium + Vitamin D", desc: "Bone supplement · 1 tablet · Twice a day", badge: "" },
      ],
    },
    {
      emoji: "🌙", name: "EVENING", when: "Take with dinner or at bedtime", theme: "evening",
      customTheme: null, visible: true,
      meds: [
        { emoji: "🦴", name: "Calcium + Vitamin D", desc: "Bone supplement · 1 tablet · Twice a day", badge: "" },
        { emoji: "🐟", name: "Fish Oil", desc: "Omega-3 supplement · 1 capsule · Once a day", badge: "" },
      ],
    },
    {
      emoji: "⚠️", name: "AS NEEDED ONLY", when: "Do NOT take every day", theme: "asneeded",
      customTheme: null, visible: true,
      meds: [
        { emoji: "🛡️", name: "Tylenol", desc: "For pain only · Only take when you need it · Ask your doctor if unsure", badge: "⚠️ AS NEEDED" },
      ],
    },
  ],
  avoid: [
    { emoji: "💊", text: "Any medicine not on this list without asking first" },
    { emoji: "🚫", text: "Grapefruit juice · Alcohol" },
  ],
  notes: "",
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A fresh copy — callers may mutate the result freely. */
export function defaultLayout(): ReminderLayout {
  return clone(DEFAULT_LAYOUT);
}

export function resolveTheme(section: ReminderSection): CustomTheme {
  if (section.theme === "custom" && section.customTheme) return section.customTheme;
  return THEMES[section.theme as Exclude<ThemeKey, "custom">] ?? THEMES.morning;
}

/** Build a card from a medication. `desc` mirrors the source's "dose · frequency" convention. */
export function medToCard(m: Medication): ReminderMed {
  const desc = [m.dose, m.frequency].filter((p): p is string => !!p && p.trim() !== "").join(" · ");
  return { emoji: "💊", name: m.name, desc, badge: "" };
}

const medNamesIn = (layout: ReminderLayout): Set<string> =>
  new Set(layout.sections.flatMap((s) => s.meds.map((m) => m.name.trim().toLowerCase())));

/**
 * Append active medications as one "IMPORTED" section.
 *
 * Time-of-day is NOT inferred: `Medication.frequency` is free text ("3 times a
 * day"), not a schedule, so everything lands in one section for manual sorting.
 * Names already present anywhere in the layout are flagged rather than skipped —
 * seed-once means user edits must survive re-import.
 */
export function seedSectionFromMedications(layout: ReminderLayout, meds: Medication[]): ReminderLayout {
  const active = meds.filter((m) => m.is_active);
  if (active.length === 0) return clone(layout);

  const existing = medNamesIn(layout);
  const next = clone(layout);
  next.sections.push({
    emoji: "💊",
    name: "IMPORTED",
    when: "Sort these into the right time of day",
    theme: "midday",
    customTheme: null,
    visible: true,
    meds: active.map((m) => {
      const card = medToCard(m);
      return existing.has(m.name.trim().toLowerCase()) ? { ...card, badge: "DUPLICATE?" } : card;
    }),
  });
  return next;
}

/** Append unacceptable foods to the red NO bar, skipping ones already listed. */
export function seedAvoidFromFoods(layout: ReminderLayout, foods: NutritionUnacceptableFood[]): ReminderLayout {
  const next = clone(layout);
  const existing = new Set(next.avoid.map((a) => a.text.trim().toLowerCase()));
  for (const f of foods) {
    const key = f.food_name.trim().toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    next.avoid.push({ emoji: "🚫", text: f.food_name });
  }
  return next;
}

/** Move one item up (-1) or down (+1). At a boundary, returns the list unchanged. */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Coerce anything into a renderable layout.
 *
 * Legacy or hand-edited JSON must never crash the page (spec: Error handling) —
 * the source one-pager guards its localStorage parse the same way.
 */
export function normalizeLayout(raw: unknown): ReminderLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultLayout();
  const r = raw as Partial<ReminderLayout>;
  const d = defaultLayout();
  return {
    headerEmoji: r.headerEmoji ?? d.headerEmoji,
    title: r.title ?? d.title,
    subtitle: r.subtitle ?? d.subtitle,
    sidebarHead: r.sidebarHead ?? d.sidebarHead,
    showSidebar: r.showSidebar ?? true,
    showAvoid: r.showAvoid ?? true,
    showUpdated: r.showUpdated ?? true,
    updated: r.updated ?? "",
    notes: r.notes ?? "",
    reminders: asArray<ReminderItem>(r.reminders).map((x) => ({
      emoji: x?.emoji ?? "", title: x?.title ?? "", desc: x?.desc ?? "",
    })),
    avoid: asArray<AvoidItem>(r.avoid).map((x) => ({ emoji: x?.emoji ?? "🚫", text: x?.text ?? "" })),
    sections: asArray<ReminderSection>(r.sections).map((s) => ({
      emoji: s?.emoji ?? "💊",
      name: s?.name ?? "",
      when: s?.when ?? "",
      theme: s?.theme ?? "morning",
      customTheme: s?.customTheme ?? null,
      visible: s?.visible !== false,
      meds: asArray<ReminderMed>(s?.meds).map((m) => ({
        emoji: m?.emoji ?? "💊", name: m?.name ?? "", desc: m?.desc ?? "", badge: m?.badge ?? "",
      })),
    })),
  };
}
