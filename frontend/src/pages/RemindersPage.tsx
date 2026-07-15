// frontend/src/pages/RemindersPage.tsx
// Admin-only Daily Reminders sheet: live preview + editor drawer + print.
// Renders IN-APP inside AppShell; only the print output opens a new tab.
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/form-field";
import { remindersApi } from "../api/reminders";
import { medicationsApi, type Medication } from "../api/medications";
import { unacceptableFoodsApi, type NutritionUnacceptableFood } from "../api/nutritionPlan";
import { openSummaryInNewTab } from "../api/summary";
import { buildReminderPrintHtml } from "@/lib/reminder-print";
import {
  defaultLayout, normalizeLayout, moveItem, resolveTheme,
  seedSectionFromMedications, seedAvoidFromFoods,
  type ReminderLayout, type ReminderSection, type ReminderMed, type ReminderItem, type AvoidItem,
  type ThemeKey,
} from "@/lib/reminder-layout";

const THEME_OPTIONS: { value: ThemeKey; label: string }[] = [
  { value: "morning", label: "Amber" },
  { value: "midday", label: "Green" },
  { value: "evening", label: "Indigo" },
  { value: "asneeded", label: "Red" },
  { value: "custom", label: "Custom" },
];

export default function RemindersPage() {
  const [layout, setLayout] = useState<ReminderLayout>(defaultLayout);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [medsForImport, setMedsForImport] = useState<Medication[] | null>(null);
  const [foodsForImport, setFoodsForImport] = useState<NutritionUnacceptableFood[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    remindersApi
      .get()
      .then((r) => { if (!cancelled) setLayout(normalizeLayout(r.layout)); })
      .catch(() => { if (!cancelled) setError("Could not load the reminder sheet."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Transient "Saved" confirmation: clears itself after a few seconds, or as
  // soon as the user edits again (see update() below). Cleared on unmount so
  // we never setState after the component is gone.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  // Stamp the date on every edit, mirroring the source one-pager's upd().
  // Deliberate: this stamps on EDIT, not on save, so "Last updated" reflects
  // the last edit rather than the last successful save — matches the
  // original one-pager's behaviour. Do not "fix" this to stamp on save.
  function update(mutate: (draft: ReminderLayout) => void) {
    setSaved(false);
    setLayout((prev) => {
      const next: ReminderLayout = JSON.parse(JSON.stringify(prev));
      mutate(next);
      next.updated = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await remindersApi.save(layout);
      setSaved(true);
    } catch {
      // Keep in-memory edits — never silently drop the user's work.
      setError("Could not save. Your changes are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  function print() {
    openSummaryInNewTab(buildReminderPrintHtml(layout));
  }

  async function loadMedsForImport() {
    setError(null);
    try {
      // Filter at the source so the displayed count and the empty-state text
      // are truthful for this list. seedSectionFromMedications() also filters
      // is_active internally — that's a guard for its other callers, not
      // redundant here; do not remove either filter.
      const meds = (await medicationsApi.list()).filter((m) => m.is_active);
      setMedsForImport(meds);
    } catch {
      setError("Could not load medications to import.");
    }
  }

  async function loadFoodsForImport() {
    setError(null);
    try {
      const foods = await unacceptableFoodsApi.list();
      setFoodsForImport(foods);
    } catch {
      setError("Could not load foods to import.");
    }
  }

  function importMedications() {
    if (!medsForImport) return;
    update((draft) => {
      const seeded = seedSectionFromMedications(draft, medsForImport);
      draft.sections = seeded.sections;
    });
  }

  function importFoods() {
    if (!foodsForImport) return;
    update((draft) => {
      const seeded = seedAvoidFromFoods(draft, foodsForImport);
      draft.avoid = seeded.avoid;
    });
  }

  return (
    <AppShell>
      <PageLayout
        title="Daily Reminders"
        description="A printable one-page medication and reminder sheet."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={print}>Print Daily Reminders</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : saved ? "Saved ✓" : "Save"}</Button>
            <Button variant="outline" onClick={() => setEditing(true)}>Edit this page</Button>
          </div>
        }
      >
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ReminderPreview layout={layout} />
        )}
      </PageLayout>

      <EditorDrawer
        open={editing}
        onOpenChange={setEditing}
        layout={layout}
        update={update}
        medsForImport={medsForImport}
        foodsForImport={foodsForImport}
        onLoadMeds={loadMedsForImport}
        onLoadFoods={loadFoodsForImport}
        onImportMeds={importMedications}
        onImportFoods={importFoods}
      />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Live preview — mirrors the print layout on screen.
// ---------------------------------------------------------------------------

function ReminderPreview({ layout }: { layout: ReminderLayout }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-4 text-[#111] shadow-sm">
      <div className="rounded-xl bg-[#1B4F72] px-4 py-2 text-center text-white">
        <div className="text-xl font-black leading-snug">
          <span aria-hidden="true">{layout.headerEmoji}</span>{" "}
          <span>{layout.title}</span>{" "}
          <span aria-hidden="true">{layout.headerEmoji}</span>
        </div>
        <div className="mt-1 text-sm font-bold opacity-90">{layout.subtitle}</div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        {layout.showSidebar && (
          <div className="flex w-full shrink-0 flex-col gap-2 rounded-xl border-2 border-[#2E7D52] bg-[#EAF6EE] p-2 md:w-48">
            <div className="border-b border-[#2E7D52]/30 pb-1.5 text-center text-sm font-black text-[#1A5C35]">
              {layout.sidebarHead}
            </div>
            {layout.reminders.map((r, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-lg bg-white/70 p-2 text-center">
                <div className="text-2xl leading-none">{r.emoji}</div>
                <div className="text-sm font-black text-[#1A5C35]">{r.title}</div>
                <div className="text-xs font-bold text-[#444]">{r.desc}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {layout.sections.filter((s) => s.visible).map((s, i) => {
            const t = resolveTheme(s);
            return (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ background: t.bg, border: `3px solid ${t.border}` }}
              >
                <div className="mb-1.5 flex items-center gap-2 border-b border-black/10 pb-1.5">
                  <div className="shrink-0 text-2xl leading-none">{s.emoji}</div>
                  <div className="text-lg font-black" style={{ color: t.title }}>{s.name}</div>
                  <div className="ml-auto text-right text-xs font-bold text-[#555]">{s.when}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {s.meds.map((m, j) => (
                    <div key={j} className="flex items-center gap-3 rounded-lg bg-white/80 px-3 py-1.5">
                      <div className="shrink-0 text-xl leading-none">{m.emoji}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-black">{m.name}</div>
                        {m.desc && <div className="text-xs font-bold text-[#555]">{m.desc}</div>}
                      </div>
                      {m.badge && (
                        <div className="ml-auto shrink-0 rounded-md bg-[#D93535] px-2 py-1 text-xs font-black text-white">
                          {m.badge}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {layout.showAvoid && layout.avoid.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-[#D93535] bg-[#FFF0F0] p-3">
          <div className="shrink-0 border-r-2 border-[#D93535]/30 pr-3 text-lg font-black text-[#A31E1E]">
            🚫 NO
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {layout.avoid.map((a, i) => (
              <div key={i} className="text-sm font-bold text-[#7A1010]">{a.emoji} {a.text}</div>
            ))}
          </div>
        </div>
      )}

      {layout.notes.trim() && (
        <div className="rounded-lg border border-[#C3D2DE] bg-[#F4F8FB] p-2">
          <div className="text-xs font-black text-[#33536b]">📝 NOTES</div>
          <div className="whitespace-pre-wrap text-sm font-bold text-[#333]">{layout.notes}</div>
        </div>
      )}

      {layout.showUpdated && layout.updated && (
        <div className="text-right text-xs font-bold text-[#8a98a4]">Last updated: {layout.updated}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor drawer
// ---------------------------------------------------------------------------

interface EditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: ReminderLayout;
  update: (mutate: (draft: ReminderLayout) => void) => void;
  medsForImport: Medication[] | null;
  foodsForImport: NutritionUnacceptableFood[] | null;
  onLoadMeds: () => void;
  onLoadFoods: () => void;
  onImportMeds: () => void;
  onImportFoods: () => void;
}

function EditorDrawer({
  open, onOpenChange, layout, update,
  medsForImport, foodsForImport, onLoadMeds, onLoadFoods, onImportMeds, onImportFoods,
}: EditorDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col gap-6 overflow-y-auto border-l border-border bg-card p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-foreground">Edit Daily Reminders</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close editor">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <HeaderGroup layout={layout} update={update} />
          <RemindersGroup layout={layout} update={update} />
          <SectionsGroup layout={layout} update={update} />
          <AvoidGroup layout={layout} update={update} />
          <NotesGroup layout={layout} update={update} />
          <UpdatedGroup layout={layout} update={update} />
          <ImportGroup
            medsForImport={medsForImport}
            foodsForImport={foodsForImport}
            onLoadMeds={onLoadMeds}
            onLoadFoods={onLoadFoods}
            onImportMeds={onImportMeds}
            onImportFoods={onImportFoods}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

function ReorderRemoveButtons({
  onUp, onDown, onRemove, upDisabled, downDisabled,
}: { onUp: () => void; onDown: () => void; onRemove: () => void; upDisabled?: boolean; downDisabled?: boolean }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="outline" size="icon-sm" aria-label="Move up" onClick={onUp} disabled={upDisabled}>↑</Button>
      <Button variant="outline" size="icon-sm" aria-label="Move down" onClick={onDown} disabled={downDisabled}>↓</Button>
      <Button variant="ghost" size="icon-sm" aria-label="Remove" className="text-destructive hover:text-destructive" onClick={onRemove}>✕</Button>
    </div>
  );
}

function HeaderGroup({ layout, update }: { layout: ReminderLayout; update: EditorDrawerProps["update"] }) {
  return (
    <section className="flex flex-col gap-3">
      <GroupHeading>Header</GroupHeading>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Header emoji</span>
        <Input
          value={layout.headerEmoji}
          onChange={(e) => update((d) => { d.headerEmoji = e.target.value; })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Title</span>
        <Input
          value={layout.title}
          onChange={(e) => update((d) => { d.title = e.target.value; })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Subtitle</span>
        <Input
          value={layout.subtitle}
          onChange={(e) => update((d) => { d.subtitle = e.target.value; })}
        />
      </label>
    </section>
  );
}

function RemindersGroup({ layout, update }: { layout: ReminderLayout; update: EditorDrawerProps["update"] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <GroupHeading>Daily reminders (sidebar)</GroupHeading>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={layout.showSidebar}
            onChange={(e) => update((d) => { d.showSidebar = e.target.checked; })}
          />
          Show
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Sidebar heading</span>
        <Input
          value={layout.sidebarHead}
          onChange={(e) => update((d) => { d.sidebarHead = e.target.value; })}
        />
      </label>
      <div className="flex flex-col gap-2">
        {layout.reminders.map((r, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-2">
            <div className="flex flex-1 flex-col gap-1">
              <Input
                aria-label={`Reminder ${i + 1} emoji`}
                className="w-16"
                value={r.emoji}
                onChange={(e) => update((d) => { d.reminders[i].emoji = e.target.value; })}
              />
              <Input
                aria-label={`Reminder ${i + 1} title`}
                value={r.title}
                onChange={(e) => update((d) => { d.reminders[i].title = e.target.value; })}
              />
              <Input
                aria-label={`Reminder ${i + 1} description`}
                value={r.desc}
                onChange={(e) => update((d) => { d.reminders[i].desc = e.target.value; })}
              />
            </div>
            <ReorderRemoveButtons
              upDisabled={i === 0}
              downDisabled={i === layout.reminders.length - 1}
              onUp={() => update((d) => { d.reminders = moveItem(d.reminders, i, -1); })}
              onDown={() => update((d) => { d.reminders = moveItem(d.reminders, i, 1); })}
              onRemove={() => update((d) => { d.reminders.splice(i, 1); })}
            />
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => update((d) => {
          const item: ReminderItem = { emoji: "⭐", title: "New reminder", desc: "" };
          d.reminders.push(item);
        })}
      >
        + Add reminder
      </Button>
    </section>
  );
}

function SectionsGroup({ layout, update }: { layout: ReminderLayout; update: EditorDrawerProps["update"] }) {
  return (
    <section className="flex flex-col gap-3">
      <GroupHeading>Medication schedule</GroupHeading>
      <div className="flex flex-col gap-4">
        {layout.sections.map((s, i) => (
          <SectionEditor
            key={i}
            section={s}
            index={i}
            total={layout.sections.length}
            update={update}
          />
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => update((d) => {
          const section: ReminderSection = {
            emoji: "💊", name: "NEW SECTION", when: "", theme: "morning",
            customTheme: null, visible: true, meds: [],
          };
          d.sections.push(section);
        })}
      >
        + Add time section
      </Button>
    </section>
  );
}

function SectionEditor({
  section, index, total, update,
}: { section: ReminderSection; index: number; total: number; update: EditorDrawerProps["update"] }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start gap-2">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={section.visible}
            onChange={(e) => update((d) => { d.sections[index].visible = e.target.checked; })}
          />
          Show
        </label>
        <Input
          aria-label={`Section ${index + 1} emoji`}
          className="w-16"
          value={section.emoji}
          onChange={(e) => update((d) => { d.sections[index].emoji = e.target.value; })}
        />
        <Input
          aria-label={`Section ${index + 1} name`}
          value={section.name}
          onChange={(e) => update((d) => { d.sections[index].name = e.target.value; })}
        />
        <ReorderRemoveButtons
          upDisabled={index === 0}
          downDisabled={index === total - 1}
          onUp={() => update((d) => { d.sections = moveItem(d.sections, index, -1); })}
          onDown={() => update((d) => { d.sections = moveItem(d.sections, index, 1); })}
          onRemove={() => update((d) => { d.sections.splice(index, 1); })}
        />
      </div>
      <Input
        aria-label={`Section ${index + 1} when`}
        placeholder="When (e.g. Take in the morning)"
        value={section.when}
        onChange={(e) => update((d) => { d.sections[index].when = e.target.value; })}
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Theme</span>
        <Select
          aria-label={`Section ${index + 1} theme`}
          value={section.theme}
          onChange={(e) => update((d) => {
            const theme = e.target.value as ThemeKey;
            d.sections[index].theme = theme;
            if (theme === "custom" && !d.sections[index].customTheme) {
              d.sections[index].customTheme = { bg: "#FFFFFF", border: "#000000", title: "#000000" };
            }
          })}
        >
          {THEME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </label>
      {section.theme === "custom" && (
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Background</span>
            <input
              type="text"
              aria-label={`Section ${index + 1} custom background`}
              className="h-8 w-24 rounded-md border border-input px-2 text-xs"
              value={section.customTheme?.bg ?? "#FFFFFF"}
              onChange={(e) => update((d) => {
                const ct = d.sections[index].customTheme ?? { bg: "#FFFFFF", border: "#000000", title: "#000000" };
                d.sections[index].customTheme = { ...ct, bg: e.target.value };
              })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Border</span>
            <input
              type="text"
              aria-label={`Section ${index + 1} custom border`}
              className="h-8 w-24 rounded-md border border-input px-2 text-xs"
              value={section.customTheme?.border ?? "#000000"}
              onChange={(e) => update((d) => {
                const ct = d.sections[index].customTheme ?? { bg: "#FFFFFF", border: "#000000", title: "#000000" };
                d.sections[index].customTheme = { ...ct, border: e.target.value };
              })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Title</span>
            <input
              type="text"
              aria-label={`Section ${index + 1} custom title color`}
              className="h-8 w-24 rounded-md border border-input px-2 text-xs"
              value={section.customTheme?.title ?? "#000000"}
              onChange={(e) => update((d) => {
                const ct = d.sections[index].customTheme ?? { bg: "#FFFFFF", border: "#000000", title: "#000000" };
                d.sections[index].customTheme = { ...ct, title: e.target.value };
              })}
            />
          </label>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-2">
        {section.meds.map((m, j) => (
          <div key={j} className="flex items-start gap-2 rounded-md bg-muted/30 p-2">
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex gap-1">
                <Input
                  aria-label={`Section ${index + 1} medication ${j + 1} emoji`}
                  className="w-16"
                  value={m.emoji}
                  onChange={(e) => update((d) => { d.sections[index].meds[j].emoji = e.target.value; })}
                />
                <Input
                  aria-label={`Section ${index + 1} medication ${j + 1} name`}
                  value={m.name}
                  onChange={(e) => update((d) => { d.sections[index].meds[j].name = e.target.value; })}
                />
              </div>
              <Input
                aria-label={`Section ${index + 1} medication ${j + 1} description`}
                value={m.desc}
                onChange={(e) => update((d) => { d.sections[index].meds[j].desc = e.target.value; })}
              />
              <Input
                aria-label={`Section ${index + 1} medication ${j + 1} badge`}
                placeholder="Badge (e.g. AS NEEDED)"
                value={m.badge}
                onChange={(e) => update((d) => { d.sections[index].meds[j].badge = e.target.value; })}
              />
            </div>
            <ReorderRemoveButtons
              upDisabled={j === 0}
              downDisabled={j === section.meds.length - 1}
              onUp={() => update((d) => { d.sections[index].meds = moveItem(d.sections[index].meds, j, -1); })}
              onDown={() => update((d) => { d.sections[index].meds = moveItem(d.sections[index].meds, j, 1); })}
              onRemove={() => update((d) => { d.sections[index].meds.splice(j, 1); })}
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => update((d) => {
            const med: ReminderMed = { emoji: "💊", name: "New medication", desc: "", badge: "" };
            d.sections[index].meds.push(med);
          })}
        >
          + Add medication
        </Button>
      </div>
    </div>
  );
}

function AvoidGroup({ layout, update }: { layout: ReminderLayout; update: EditorDrawerProps["update"] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <GroupHeading>Foods to avoid</GroupHeading>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={layout.showAvoid}
            onChange={(e) => update((d) => { d.showAvoid = e.target.checked; })}
          />
          Show
        </label>
      </div>
      <div className="flex flex-col gap-2">
        {layout.avoid.map((a, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-2">
            <Input
              aria-label={`Avoid item ${i + 1} emoji`}
              className="w-16"
              value={a.emoji}
              onChange={(e) => update((d) => { d.avoid[i].emoji = e.target.value; })}
            />
            <Input
              aria-label={`Avoid item ${i + 1} text`}
              value={a.text}
              onChange={(e) => update((d) => { d.avoid[i].text = e.target.value; })}
            />
            <ReorderRemoveButtons
              upDisabled={i === 0}
              downDisabled={i === layout.avoid.length - 1}
              onUp={() => update((d) => { d.avoid = moveItem(d.avoid, i, -1); })}
              onDown={() => update((d) => { d.avoid = moveItem(d.avoid, i, 1); })}
              onRemove={() => update((d) => { d.avoid.splice(i, 1); })}
            />
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => update((d) => {
          const item: AvoidItem = { emoji: "🚫", text: "" };
          d.avoid.push(item);
        })}
      >
        + Add item
      </Button>
    </section>
  );
}

function NotesGroup({ layout, update }: { layout: ReminderLayout; update: EditorDrawerProps["update"] }) {
  return (
    <section className="flex flex-col gap-2">
      <GroupHeading>Notes</GroupHeading>
      <Textarea
        aria-label="Notes"
        rows={4}
        value={layout.notes}
        onChange={(e) => update((d) => { d.notes = e.target.value; })}
      />
    </section>
  );
}

function UpdatedGroup({ layout, update }: { layout: ReminderLayout; update: EditorDrawerProps["update"] }) {
  return (
    <section className="flex items-center justify-between">
      <GroupHeading>Last-updated stamp</GroupHeading>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={layout.showUpdated}
          onChange={(e) => update((d) => { d.showUpdated = e.target.checked; })}
        />
        Show
      </label>
    </section>
  );
}

function ImportGroup({
  medsForImport, foodsForImport, onLoadMeds, onLoadFoods, onImportMeds, onImportFoods,
}: {
  medsForImport: Medication[] | null;
  foodsForImport: NutritionUnacceptableFood[] | null;
  onLoadMeds: () => void;
  onLoadFoods: () => void;
  onImportMeds: () => void;
  onImportFoods: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <GroupHeading>Import</GroupHeading>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onLoadMeds}
        >
          Import from Medications
        </Button>
        {medsForImport !== null && (
          medsForImport.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active medications found to import.</p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{medsForImport.length} active medication(s) found.</p>
              <Button size="sm" onClick={onImportMeds}>Add to schedule</Button>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onLoadFoods}
        >
          Import Foods to Avoid
        </Button>
        {foodsForImport !== null && (
          foodsForImport.length === 0 ? (
            <p className="text-xs text-muted-foreground">No unacceptable foods found to import.</p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{foodsForImport.length} food(s) found.</p>
              <Button size="sm" onClick={onImportFoods}>Add to avoid list</Button>
            </div>
          )
        )}
      </div>
    </section>
  );
}
