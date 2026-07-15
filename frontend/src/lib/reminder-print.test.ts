import { describe, it, expect } from "vitest";
import { buildReminderPrintHtml } from "./reminder-print";
import { defaultLayout } from "./reminder-layout";

describe("buildReminderPrintHtml", () => {
  it("emits a print-sized standalone document that self-prints", () => {
    const html = buildReminderPrintHtml(defaultLayout());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("size: 8.5in 11in");
    expect(html).toContain("window.print()");
  });

  it("renders the title and medication names", () => {
    const html = buildReminderPrintHtml(defaultLayout());
    expect(html).toContain("MY DAILY MEDICATIONS");
    expect(html).toContain("Multivitamin");
  });

  it("escapes HTML in user-supplied text", () => {
    const l = defaultLayout();
    l.title = `<script>alert("x")</script>`;
    const html = buildReminderPrintHtml(l);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("omits sections marked not visible", () => {
    const l = defaultLayout();
    l.sections[0].visible = false;
    expect(buildReminderPrintHtml(l)).not.toContain("MORNING");
  });

  it("omits the sidebar when showSidebar is false", () => {
    const l = defaultLayout();
    l.showSidebar = false;
    expect(buildReminderPrintHtml(l)).not.toContain("DAILY REMINDERS");
  });

  it("omits the avoid bar when showAvoid is false", () => {
    const l = defaultLayout();
    l.showAvoid = false;
    expect(buildReminderPrintHtml(l)).not.toContain("Grapefruit");
  });

  it("renders notes only when non-empty", () => {
    const empty = defaultLayout();
    expect(buildReminderPrintHtml(empty)).not.toContain("📝 NOTES");
    const filled = { ...empty, notes: "Call the pharmacy" };
    const html = buildReminderPrintHtml(filled);
    expect(html).toContain("📝 NOTES");
    expect(html).toContain("Call the pharmacy");
  });

  it("renders the updated stamp only when shown and set", () => {
    const l = { ...defaultLayout(), showUpdated: true, updated: "July 15, 2026" };
    expect(buildReminderPrintHtml(l)).toContain("July 15, 2026");
    expect(buildReminderPrintHtml({ ...l, showUpdated: false })).not.toContain("July 15, 2026");
  });

  it("applies a custom theme's colours", () => {
    const l = defaultLayout();
    l.sections[0].theme = "custom";
    l.sections[0].customTheme = { bg: "#ABCDEF", border: "#123456", title: "#654321" };
    expect(buildReminderPrintHtml(l)).toContain("#ABCDEF");
  });

  it("renders a med badge when present", () => {
    expect(buildReminderPrintHtml(defaultLayout())).toContain("AS NEEDED");
  });
});
