import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, Activity, AlertTriangle, Phone, Shield, Pill, Eye, FilePlus } from "lucide-react";
import { calendarApi, type CalendarEvent, EVENT_TYPE_LABELS } from "../api/calendar";
import { getProfile, type Profile } from "../api/profile";
import { vitalsApi, type Vitals } from "../api/vitals";
import { medicationsApi, type Medication } from "../api/medications";
import { visitLogsApi, type VisitLog } from "../api/visitLogs";
import { surgeriesApi, type Surgery } from "../api/surgeries";
import { hospitalizationsApi, type Hospitalization } from "../api/hospitalizations";
import { vaccinationsApi, type Vaccination } from "../api/vaccinations";
import { insurancesApi, type Insurance } from "../api/insurances";
import { pharmaciesApi, type Pharmacy } from "../api/pharmacies";
import { doctorsApi, type Doctor } from "../api/doctors";
import { openSummaryInNewTab } from "../api/summary";
import { parseAllergies, parseContacts, type Allergy, type EmergencyContact } from "@/lib/profile-parsers";
import { useAuth } from "../auth/useAuth";
import { formatDate } from "@/lib/format";
import { formatInTimezone } from "@/lib/datetime";
import { escapeHtml } from "@/lib/html";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatEventTime(e: CalendarEvent, tz: string): string {
  if (e.type === "appointment" && e.time) {
    return formatInTimezone(`${e.date}T${e.time}:00Z`, tz);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(e.date + "T00:00:00Z")
  );
}

function getGreeting(tz: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()),
    10
  );
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function SectionCard({ title, to, icon: Icon, children }: { title: string; to: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground shrink-0" />
              {title}
            </h2>
            <Link to={to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View →
            </Link>
          </div>
          <div className="mt-2 border-t border-border" />
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm py-0.5">
      <span className="min-w-30 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}

function buildPrintHtml(opts: {
  profile: Profile | null;
  mainDoctor: Doctor | null;
  latestVitals: Vitals | null;
  activeMeds: Medication[];
  allergies: Allergy[];
  contacts: EmergencyContact[];
  insurances: Insurance[];
  pharmacies: Pharmacy[];
}): string {
  const { profile, mainDoctor, latestVitals, activeMeds, allergies, contacts, insurances, pharmacies } = opts;
  const name = profile?.full_name || "";
  const pageTitle = name ? `Patient Summary — ${name}` : "Patient Summary";
  const dob = profile?.date_of_birth
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
        new Date(profile.date_of_birth + "T00:00:00Z")
      )
    : "Not set";
  const bloodType = profile?.blood_type || "Not set";
  const doctorLine = mainDoctor
    ? `${mainDoctor.name}${mainDoctor.specialty ? ` (${mainDoctor.specialty})` : ""}`
    : "Not set";

  const vitalsHtml = latestVitals
    ? `<ul>
        <li><b>Date:</b> ${escapeHtml(formatDate(latestVitals.measured_at))}</li>
        ${latestVitals.bp_systolic != null && latestVitals.bp_diastolic != null ? `<li><b>BP:</b> ${escapeHtml(String(latestVitals.bp_systolic))}/${escapeHtml(String(latestVitals.bp_diastolic))}</li>` : ""}
        ${latestVitals.pulse_bpm != null ? `<li><b>Pulse:</b> ${escapeHtml(String(latestVitals.pulse_bpm))} bpm</li>` : ""}
        ${latestVitals.weight_lb != null ? `<li><b>Weight:</b> ${escapeHtml(String(latestVitals.weight_lb))} lbs</li>` : ""}
      </ul>`
    : "<p>No vitals on file.</p>";

  // Mirrors the dashboard card: name, then a dimmer "used for · pharmacy" line.
  const medsHtml = activeMeds.length > 0
    ? `<ul>${activeMeds.map((m) => {
        const sub = [m.used_for, m.pharmacy_name].filter(Boolean).map((v) => escapeHtml(String(v))).join(" · ");
        return `<li>${escapeHtml(m.name)}${sub ? `<br><span class="sub">${sub}</span>` : ""}</li>`;
      }).join("")}</ul>`
    : "<p>None on file.</p>";

  const allergiesHtml = allergies.length > 0
    ? allergies.map((a) => `<div class="item"><b>${escapeHtml(a.medication || "—")}</b> · ${escapeHtml(a.reaction || "—")} · Age of onset: ${escapeHtml(a.age_of_onset || "—")}</div>`).join("")
    : "<p>No allergies on file.</p>";

  const contactsHtml = contacts.length > 0
    ? contacts.map((c) => `<div class="item"><b>${escapeHtml(c.name || "—")}</b> · ${escapeHtml(c.relationship || "—")}${c.phone ? ` · ${escapeHtml(c.phone)}` : ""}${c.email ? ` · ${escapeHtml(c.email)}` : ""}</div>`).join("")
    : "<p>No emergency contacts on file.</p>";

  const insuranceHtml = insurances.length > 0
    ? insurances.map((i) => `<div class="item"><b>${escapeHtml(i.insurer_name)}</b>${i.policy_number ? ` · Policy: ${escapeHtml(i.policy_number)}` : ""}${i.group_number ? ` · Group: ${escapeHtml(i.group_number)}` : ""}${i.contact_phone ? ` · ${escapeHtml(i.contact_phone)}` : ""}</div>`).join("")
    : "<p>No insurance on file.</p>";

  const pharmaciesHtml = pharmacies.length > 0
    ? pharmacies.map((p) => `<div class="item"><b>${escapeHtml(p.name)}</b>${p.address ? ` · ${escapeHtml(p.address)}` : ""}${p.phone ? ` · ${escapeHtml(p.phone)}` : ""}</div>`).join("")
    : "<p>No pharmacies on file.</p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 24px auto; color: #111; font-size: 13px; line-height: 1.5; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin: 18px 0 6px; }
    .meta { color: #333; font-size: 13px; margin-bottom: 16px; }
    ul { margin: 4px 0 0 20px; padding: 0; }
    li { margin-bottom: 2px; }
    .item { margin-bottom: 6px; }
    p { margin: 4px 0; }
    .empty { color: #888; font-size: 12px; }
    .sub { color: #555; font-size: 11px; }
    @media print { body { margin: 0; } }
  </style>
  <script>window.onload = function() { window.print(); }</script>
</head>
<body>
  <h1>${escapeHtml(name || "Patient")}</h1>
  <div class="meta">
    <span><b>DOB:</b> ${escapeHtml(dob)}</span> &nbsp;·&nbsp;
    <span><b>Blood Type:</b> ${escapeHtml(bloodType)}</span> &nbsp;·&nbsp;
    <span><b>Main Doctor:</b> ${escapeHtml(doctorLine)}</span>
  </div>

  <h2>Most Recent Vitals</h2>
  ${vitalsHtml}

  <h2>Active Medications</h2>
  ${medsHtml}

  <h2>Allergies</h2>
  ${allergiesHtml}

  <h2>Emergency Contacts</h2>
  ${contactsHtml}

  <h2>Insurance</h2>
  ${insuranceHtml}

  <h2>Pharmacies</h2>
  ${pharmaciesHtml}
</body>
</html>`;
}

export default function HomePage() {
  const { user } = useAuth();
  const tz = user?.timezone ?? "America/Chicago";

  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [latestVitals, setLatestVitals] = useState<Vitals | null>(null);
  const [activeMeds, setActiveMeds] = useState<Medication[]>([]);
  const [latestVisit, setLatestVisit] = useState<VisitLog | null>(null);
  const [latestSurgery, setLatestSurgery] = useState<Surgery | null>(null);
  const [latestHospitalization, setLatestHospitalization] = useState<Hospitalization | null>(null);
  const [latestVaccination, setLatestVaccination] = useState<Vaccination | null>(null);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    const fetches = [
      calendarApi.list().then((events) => {
        const upcoming = events
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);
        setUpcomingEvents(upcoming);
      }).catch(() => {}),

      getProfile().then((p) => { if (p) setProfile(p); }).catch(() => {}),

      doctorsApi.list().then(setDoctors).catch(() => {}),

      vitalsApi.list().then((all) => {
        const sorted = [...all].sort(
          (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
        );
        setLatestVitals(sorted[0] ?? null);
      }).catch(() => {}),

      medicationsApi.list().then((all) => {
        setActiveMeds(all.filter((m) => m.is_active));
      }).catch(() => {}),

      visitLogsApi.list().then((all) => {
        const sorted = [...all].sort((a, b) =>
          (b.visit_date ?? "").localeCompare(a.visit_date ?? "")
        );
        setLatestVisit(sorted[0] ?? null);
      }).catch(() => {}),

      surgeriesApi.list().then((all) => {
        const sorted = [...all].sort((a, b) =>
          (b.surgery_date ?? "").localeCompare(a.surgery_date ?? "")
        );
        setLatestSurgery(sorted[0] ?? null);
      }).catch(() => {}),

      hospitalizationsApi.list().then((all) => {
        const sorted = [...all].sort((a, b) =>
          (b.admission_date ?? "").localeCompare(a.admission_date ?? "")
        );
        setLatestHospitalization(sorted[0] ?? null);
      }).catch(() => {}),

      vaccinationsApi.list().then((all) => {
        const sorted = [...all].sort((a, b) =>
          (b.administered_date ?? "").localeCompare(a.administered_date ?? "")
        );
        setLatestVaccination(sorted[0] ?? null);
      }).catch(() => {}),

      insurancesApi.list().then((rows) => setInsurances(rows.filter((i) => i.is_active))).catch(() => {}),
      pharmaciesApi.list().then(setPharmacies).catch(() => {}),
    ];

    Promise.allSettled(fetches).then(() => setLoading(false));
  }, []);

  const mainDoctor = profile?.main_doctor_id
    ? doctors.find((d) => d.id === profile.main_doctor_id) ?? null
    : null;

  const allergies = parseAllergies(profile?.allergies);
  const contacts = parseContacts(profile?.emergency_contacts);

  function openPrintSummary() {
    const html = buildPrintHtml({ profile, mainDoctor, latestVitals, activeMeds, allergies, contacts, insurances, pharmacies });
    openSummaryInNewTab(html);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          {/* min-w-0 lets this column shrink; without it the long greeting
              pushed Print Summary off-screen on a phone (measured 403px left
              edge in a 375px viewport). */}
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold text-foreground text-balance break-words">
              {getGreeting(tz)}, {user?.full_name || user?.email}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Personal health records are organized and ready to access. Use the sidebar to navigate.
            </p>
          </div>
          <button
            onClick={openPrintSummary}
            className="shrink-0 rounded-lg bg-orange-500/10 px-3 py-1.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-500/15 dark:text-orange-400"
          >
            Print Summary
          </button>
        </div>

        {/* Contributor role notice */}
        {user?.role === "contributor" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
            <FilePlus className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                You're signed in as a Contributor
              </p>
              <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
                You can propose changes to any health record — add a new entry, edit an
                existing one, or request a deletion. Your proposals are sent to an Admin for
                approval before they take effect. Track, edit, or withdraw anything still
                awaiting review on the{" "}
                <Link to="/my-submissions" className="font-medium underline underline-offset-2 hover:opacity-80">
                  My Submissions
                </Link>{" "}
                page. You can also add notes and to-do items on the{" "}
                <Link to="/notes" className="font-medium underline underline-offset-2 hover:opacity-80">
                  Notes / To-Do's
                </Link>{" "}
                page, and ask the 'AI Assistant' (bottom-right) to look things up for you.
              </p>
            </div>
          </div>
        )}

        {/* Viewer role notice */}
        {user?.role === "viewer" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
            <Eye className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                You're signed in as a Viewer
              </p>
              <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
                You have read-only access to every health record — browse them anytime using
                the sidebar, and use the 'AI Assistant' (bottom-right) to search or ask
                questions. If you spot something that needs changing, jot it down on the{" "}
                <Link to="/notes" className="font-medium underline underline-offset-2 hover:opacity-80">
                  Notes / To-Do's
                </Link>{" "}
                page so an Admin can follow up.
              </p>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mb-8">
            <div className="mb-3">
              <h2 className="font-heading text-sm font-semibold text-foreground">Upcoming Events</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Upcoming scheduled health events.</p>
            </div>
            <Card>
              <CardContent className="py-2 px-4 divide-y divide-border">
                {upcomingEvents.map((e) => (
                  <div key={`${e.type}-${e.id}`} className="flex items-center gap-3 py-2">
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="w-32 shrink-0 text-xs text-muted-foreground">
                      {formatEventTime(e, tz)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm text-foreground">{e.title}</span>
                      {e.type === "appointment" && e.doctor_name && (
                        <span className="block truncate text-xs text-muted-foreground">{e.doctor_name}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {EVENT_TYPE_LABELS[e.type]}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Row 1: Patient Info + Most Recent Events */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SectionCard title="Patient Info" to="/profile" icon={User}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="flex flex-col gap-0.5">
                  <Row label="Name" value={profile?.full_name ?? ""} />
                  <Row label="Date of Birth" value={profile?.date_of_birth ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(profile.date_of_birth + "T00:00:00Z")) : "Not set"} />
                  <Row label="Blood Type" value={profile?.blood_type ?? "Not set"} />
                  <Row
                    label="Main Doctor"
                    value={mainDoctor
                      ? `${mainDoctor.name}${mainDoctor.specialty ? ` (${mainDoctor.specialty})` : ""}`
                      : "Not set"}
                  />
                </div>
                {/* Most Recent Vitals */}
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Most Recent Vitals</p>
                  {latestVitals ? (
                    <div className="flex flex-col gap-0.5">
                      <Row label="Date" value={formatDate(latestVitals.measured_at)} />
                      {(latestVitals.bp_systolic != null && latestVitals.bp_diastolic != null) && (
                        <Row label="BP" value={`${latestVitals.bp_systolic}/${latestVitals.bp_diastolic}`} />
                      )}
                      {latestVitals.pulse_bpm != null && (
                        <Row label="Pulse" value={`${latestVitals.pulse_bpm} bpm`} />
                      )}
                      {latestVitals.weight_lb != null && (
                        <Row label="Weight" value={`${latestVitals.weight_lb} lbs`} />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No vitals on file.</p>
                  )}
                </div>
                {/* Active Medications */}
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Medications</p>
                  {activeMeds.length > 0 ? (
                    <ul className="list-none flex flex-col gap-0.5">
                      {activeMeds.map((m) => (
                        <li key={m.id} className="flex items-start gap-1 text-sm text-foreground">
                          <span aria-hidden="true">•</span>
                          {/* Name on its own line; what it is FOR and where it
                              comes from drop to a smaller, dimmer second line.
                              Both are optional, so the line is omitted rather
                              than left as a stray separator. */}
                          <span>
                            <span className="block">{m.name}</span>
                            {[m.used_for, m.pharmacy_name].some(Boolean) && (
                              <span className="block text-xs text-muted-foreground">
                                {[m.used_for, m.pharmacy_name].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None on file.</p>
                  )}
                </div>
              </>
            )}
          </SectionCard>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3">
                <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground shrink-0" />
                  Recent Activity
                </h2>
                <div className="mt-2 border-t border-border" />
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Doctor's Visit</p>
                      <Link to="/doc-logs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View →</Link>
                    </div>
                    {latestVisit ? (
                      <div className="flex flex-col gap-0.5">
                        <Row label="Date" value={formatDate(latestVisit.visit_date)} />
                        <Row label="Reason" value={latestVisit.reason ?? "—"} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not on file.</p>
                    )}
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Procedures</p>
                      <Link to="/procedures" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View →</Link>
                    </div>
                    {latestSurgery ? (
                      <div className="flex flex-col gap-0.5">
                        <Row label="Date" value={formatDate(latestSurgery.surgery_date)} />
                        <Row label="Procedure" value={latestSurgery.procedure} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not on file.</p>
                    )}
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hospitalization</p>
                      <Link to="/hospitalizations" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View →</Link>
                    </div>
                    {latestHospitalization ? (
                      <div className="flex flex-col gap-0.5">
                        <Row label="Admitted" value={formatDate(latestHospitalization.admission_date)} />
                        <Row label="Facility" value={latestHospitalization.facility} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not on file.</p>
                    )}
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vaccination</p>
                      <Link to="/vaccinations" className="text-xs text-muted-foreground hover:text-foreground transition-colors">View →</Link>
                    </div>
                    {latestVaccination ? (
                      <div className="flex flex-col gap-0.5">
                        <Row label="Date" value={formatDate(latestVaccination.administered_date)} />
                        <Row label="Vaccine" value={latestVaccination.vaccine} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not on file.</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Allergies + Emergency Contacts */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SectionCard title="Allergies" to="/profile" icon={AlertTriangle}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : allergies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allergies on file.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {allergies.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
                      <div><span className="text-muted-foreground">Medication: </span><span className="text-foreground">{a.medication || "—"}</span></div>
                      <div><span className="text-muted-foreground">Reaction: </span><span className="text-foreground">{a.reaction || "—"}</span></div>
                      <div><span className="text-muted-foreground">Age of Onset: </span><span className="text-foreground">{a.age_of_onset || "—"}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Emergency Contacts" to="/profile" icon={Phone}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No emergency contacts on file.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {contacts.map((c, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/20 p-2 text-sm">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      {c.is_poa && (
                        <span
                          className="inline-block size-2 shrink-0 rounded-full bg-primary"
                          aria-label="Power of Attorney"
                        />
                      )}
                      {c.name || "—"}
                    </div>
                    <div className="text-muted-foreground">{c.relationship || "—"}</div>
                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Row 3: Insurance + Pharmacies */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SectionCard title="Insurance" to="/insurance" icon={Shield}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : insurances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No insurance on file.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {insurances.map((ins) => (
                  <div key={ins.id} className="rounded-md border border-border bg-muted/20 p-2 text-sm">
                    <div className="font-medium text-foreground">{ins.insurer_name}</div>
                    {ins.policy_number && <div className="text-muted-foreground">Policy: {ins.policy_number}</div>}
                    {ins.group_number && <div className="text-xs text-muted-foreground">Group: {ins.group_number}</div>}
                    {ins.contact_phone && <div className="text-xs text-muted-foreground">{ins.contact_phone}</div>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Pharmacies" to="/pharmacies" icon={Pill}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : pharmacies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pharmacies on file.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pharmacies.map((ph) => (
                  <div key={ph.id} className="rounded-md border border-border bg-muted/20 p-2 text-sm">
                    <div className="font-medium text-foreground">{ph.name}</div>
                    {ph.address && <div className="text-muted-foreground">{ph.address}</div>}
                    {ph.phone && <div className="text-xs text-muted-foreground">{ph.phone}</div>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
