import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../auth/GuestContext";
import { Button } from "@/components/ui/button";
import SummaryBuilder from "./SummaryBuilder";
import { applyAccent } from "./accent-picker";
import { getGuestPatientName } from "../api/guest";

const SECTION_LABELS: Record<string, string> = {
  surgeries: "Procedures",
  hospitalizations: "Hospitalizations",
  vision_history: "Vision History",
  dental_history: "Dental History",
  visit_logs: "Visit & Call Logs",
  vitals: "Vitals",
  appointments: "Appointments",
  medications: "Medications",
  vaccinations: "Vaccinations",
  insurances: "Insurance",
  ailments: "Ailment History",
  doctors: "Doctors",
  pharmacies: "Pharmacies",
  family_history: "Family History",
  nutrition_plan: "Nutrition Plan",
  profile: "Profile",
};

interface Props {
  children: ReactNode;
  expired?: boolean;
}

export default function GuestLayout({ children, expired }: Props) {
  const { allowedSections, expiresAt, token } = useGuest();

  const [patientName, setPatientName] = useState<string | null>(null);
  useEffect(() => {
    if (token) getGuestPatientName(token).then(setPatientName);
  }, [token]);

  useEffect(() => {
    const prevDark = document.documentElement.classList.contains("dark");
    const prevAccent = (document.getElementById("ht-accent-override") as HTMLStyleElement | null)?.textContent ?? "";
    document.documentElement.classList.remove("dark");
    applyAccent("orange", false);
    return () => {
      document.documentElement.classList.toggle("dark", prevDark);
      const el = document.getElementById("ht-accent-override") as HTMLStyleElement | null;
      if (el) el.textContent = prevAccent;
    };
  }, []);

  if (expired) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">Link Expired or Revoked</h1>
          <p className="text-muted-foreground">This share link is no longer valid. Please contact the person who shared it with you.</p>
          <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Already have your link?</p>
            <p className="mt-1">
              If you don't believe this link has expired or been revoked, your session may simply
              have ended (for your privacy, access isn't kept after closing or refreshing the page).
              Re-enter the original link you were given in your browser's address bar to view the
              records again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <header className="pb-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {patientName ?? "Healthcare Records"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Read-Only Access</p>
          {expiresAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              This link expires on {new Date(expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {allowedSections.length > 0 && (
          <SummaryBuilder
            mode="guest"
            availableSections={allowedSections}
            token={token ?? ""}
            description="Generate a printable summary of the Patient's Records that have been shared with you."
            triggerClassName="border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500 hover:text-amber-950 shadow-[0_8px_24px_-2px_rgba(0,0,0,0.14),0_1px_2px_0_rgba(0,0,0,0.10)]"
          />
        )}
      </header>
      <nav className="flex flex-wrap gap-2 mb-6">
        {allowedSections.map((s) => (
          <Button key={s} size="sm" asChild className="shadow-[0_8px_24px_-2px_rgba(0,0,0,0.14),0_1px_2px_0_rgba(0,0,0,0.10)]">
            <Link to={`/guest/sections/${s}`}>
              {SECTION_LABELS[s] ?? s}
            </Link>
          </Button>
        ))}
      </nav>
      {children}
      <footer className="mt-10 pt-4 border-t border-border flex flex-col items-center gap-0.5 text-center text-[0.7rem] text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
          <span>© {new Date().getFullYear()}</span>
          <a href="https://spicylimes.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <img src="/spicylimes.png" alt="SpicyLimes.io" className="size-4" />
            SpicyLimes.io
          </a>
          <span>· All Rights Reserved ·</span>
          <a
            href="https://github.com/SpicyLimes/Healthcare-Tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <img src="/github_black.svg" alt="" className="size-4" />
            <span>GitHub ↗</span>
          </a>
        </div>
        <p className="italic">For Personal Health Record Keeping ONLY - Not a substitute for Professional Medical Advice</p>
        <p className="mt-2 text-xs not-italic">
          For your privacy, this link isn't saved in your browser. If you refresh or close this page,
          you'll need to re-enter the original link you were given to access these records again.
        </p>
      </footer>
    </main>
  );
}
