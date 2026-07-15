// frontend/src/lib/reminder-print.ts
// Builds the standalone printable sheet. CSS ported from the source one-pager
// (the "One-Page Reminders" editor prototype) — the layout is the asset worth keeping.
//
// Mirrors buildPrintHtml in pages/HomePage.tsx. The caller opens the result via
// openSummaryInNewTab (api/summary.ts) — a Blob URL, NOT window.open.
import { escapeHtml } from "./html";
import { resolveTheme, type ReminderLayout } from "./reminder-layout";

export function buildReminderPrintHtml(layout: ReminderLayout): string {
  const e = escapeHtml;

  const sidebar = layout.showSidebar
    ? `<div class="sidebar">
        <div class="sidebar-head">${e(layout.sidebarHead)}</div>
        ${layout.reminders
          .map(
            (r) => `<div class="reminder">
              <div class="reminder-emoji">${e(r.emoji)}</div>
              <div class="reminder-title">${e(r.title)}</div>
              <div class="reminder-desc">${e(r.desc)}</div>
            </div>`
          )
          .join("")}
      </div>`
    : "";

  const sections = layout.sections
    .filter((s) => s.visible)
    .map((s) => {
      const t = resolveTheme(s);
      const meds = s.meds
        .map(
          (m) => `<div class="med">
            <div class="med-emoji">${e(m.emoji)}</div>
            <div class="med-body">
              <div class="med-name">${e(m.name)}</div>
              ${m.desc ? `<div class="med-desc">${e(m.desc)}</div>` : ""}
            </div>
            ${m.badge ? `<div class="badge">${e(m.badge)}</div>` : ""}
          </div>`
        )
        .join("");
      return `<div class="section" style="background:${e(t.bg)}; border:3px solid ${e(t.border)};">
        <div class="section-head">
          <div class="section-emoji">${e(s.emoji)}</div>
          <div class="section-title" style="color:${e(t.title)};">${e(s.name)}</div>
          <div class="section-when">${e(s.when)}</div>
        </div>
        <div class="meds">${meds}</div>
      </div>`;
    })
    .join("");

  const avoid =
    layout.showAvoid && layout.avoid.length > 0
      ? `<div class="avoid">
          <div class="avoid-label">🚫 NO</div>
          <div class="avoid-items">
            ${layout.avoid.map((a) => `<div class="avoid-item">${e(a.emoji)}&nbsp;&nbsp;${e(a.text)}</div>`).join("")}
          </div>
        </div>`
      : "";

  const notes = layout.notes.trim()
    ? `<div class="notes"><div class="notes-head">📝 NOTES</div><div class="notes-body">${e(layout.notes)}</div></div>`
    : "";

  const updated =
    layout.showUpdated && layout.updated ? `<div class="updated">Last updated: ${e(layout.updated)}</div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${e(layout.title)}</title>
<style>
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  @page { size: 8.5in 11in; margin: 0; }
  html, body { background:#fff; }
  body { font-family:'Nunito','Arial Rounded MT Bold',Arial,sans-serif; color:#111; }
  .page { width:8.5in; min-height:11in; padding:0.4in; background:#fff; display:flex; flex-direction:column; gap:0.07in;
          print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .header { background:#1B4F72; color:#fff; border-radius:14px; padding:0.10in 0.25in; text-align:center; flex-shrink:0;
            print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .header-title { font-size:24pt; line-height:1.15; font-weight:900; }
  .header-sub { font-size:12pt; font-weight:700; opacity:0.88; margin-top:3px; }
  .body { flex:1; display:flex; gap:0.1in; min-height:0; }
  .sidebar { width:2.0in; flex-shrink:0; background:#EAF6EE; border:3px solid #2E7D52; border-radius:14px;
             padding:0.1in 0.11in; display:flex; flex-direction:column; gap:0.08in;
             print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .sidebar-head { text-align:center; font-size:13pt; font-weight:900; color:#1A5C35; padding-bottom:7px;
                  border-bottom:2px solid rgba(46,125,82,0.3); }
  .reminder { background:rgba(255,255,255,0.72); border-radius:10px; padding:8px 10px; flex:1; display:flex;
              flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:5px; }
  .reminder-emoji { font-size:26pt; line-height:1; }
  .reminder-title { font-size:15pt; font-weight:900; color:#1A5C35; line-height:1.2; }
  .reminder-desc { font-size:11pt; font-weight:700; color:#444; line-height:1.35; margin-top:2px; }
  .sections { flex:1; display:flex; flex-direction:column; gap:0.06in; min-width:0; }
  .section { border-radius:12px; padding:0.09in 0.15in; flex:1; page-break-inside:avoid;
             print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .section-head { display:flex; align-items:center; gap:10px; padding-bottom:6px;
                  border-bottom:2px solid rgba(0,0,0,0.1); margin-bottom:0.06in; }
  .section-emoji { font-size:24pt; line-height:1; flex-shrink:0; }
  .section-title { font-size:21pt; font-weight:900; }
  .section-when { font-size:11pt; font-weight:700; color:#555; margin-left:auto; text-align:right; }
  .meds { display:flex; flex-direction:column; gap:5px; }
  .med { display:flex; align-items:center; gap:12px; padding:6px 12px; background:rgba(255,255,255,0.78); border-radius:9px; }
  .med-emoji { font-size:22pt; flex-shrink:0; line-height:1; }
  .med-name { font-size:19pt; font-weight:900; color:#111; line-height:1.15; }
  .med-desc { font-size:11.5pt; font-weight:700; color:#555; margin-top:2px; }
  .badge { background:#D93535; color:#fff; font-size:11pt; font-weight:900; padding:5px 12px; border-radius:8px;
           white-space:nowrap; flex-shrink:0; margin-left:auto;
           print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .avoid { flex-shrink:0; background:#FFF0F0; border:3px solid #D93535; border-radius:14px; padding:0.09in 0.16in;
           display:flex; align-items:center; gap:0.14in; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .avoid-label { font-size:20pt; font-weight:900; color:#A31E1E; white-space:nowrap; flex-shrink:0;
                 padding-right:0.12in; border-right:2.5px solid rgba(211,53,53,0.3); }
  .avoid-items { display:flex; flex-direction:column; gap:5px; flex:1; }
  .avoid-item { font-size:12.5pt; font-weight:800; color:#7A1010; line-height:1.3; }
  .notes { flex-shrink:0; background:#F4F8FB; border:2px solid #C3D2DE; border-radius:12px; padding:0.08in 0.16in;
           print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .notes-head { font-size:11pt; font-weight:900; color:#33536b; margin-bottom:2px; }
  .notes-body { font-size:12pt; font-weight:700; color:#333; line-height:1.35; white-space:pre-wrap; }
  .updated { flex-shrink:0; text-align:right; font-size:9.5pt; font-weight:700; color:#8a98a4; padding:0 4px; }
</style>
<script>window.onload = function() { window.print(); }</script>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-title">${e(layout.headerEmoji)}&nbsp;&nbsp;${e(layout.title)}&nbsp;&nbsp;${e(layout.headerEmoji)}</div>
      <div class="header-sub">${e(layout.subtitle)}</div>
    </div>
    <div class="body">
      ${sidebar}
      <div class="sections">${sections}</div>
    </div>
    ${avoid}
    ${notes}
    ${updated}
  </div>
</body>
</html>`;
}
