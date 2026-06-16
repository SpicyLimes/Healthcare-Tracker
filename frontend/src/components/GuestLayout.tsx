import { type ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../auth/GuestContext";
import { Button } from "@/components/ui/button";
import SummaryBuilder from "./SummaryBuilder";
import { applyAccent } from "./accent-picker";

const SECTION_LABELS: Record<string, string> = {
  surgeries: "Surgeries",
  hospitalizations: "Hospitalizations",
  vision_history: "Vision History",
  dental_history: "Dental History",
  visit_logs: "Visit Logs",
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
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Link Expired or Revoked</h1>
          <p className="text-muted-foreground">This share link is no longer valid. Please contact the person who shared it with you.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <header className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-semibold text-foreground">Healthcare Records — Read Only Access</h2>
        {expiresAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            This link expires on {new Date(expiresAt).toLocaleDateString()}
          </p>
        )}
      </header>
      <nav className="flex flex-wrap gap-2 mb-6">
        {allowedSections.map((s) => (
          <Button key={s} variant="outline" size="sm" asChild>
            <Link to={`/guest/sections/${s}`}>
              {SECTION_LABELS[s] ?? s}
            </Link>
          </Button>
        ))}
        {allowedSections.length > 0 && (
          <SummaryBuilder mode="guest" availableSections={allowedSections} token={token ?? ""} />
        )}
      </nav>
      {children}
    </main>
  );
}
