import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useGuest } from "../auth/GuestContext";

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
  profile: "Profile",
};

interface Props {
  children: ReactNode;
  expired?: boolean;
}

export default function GuestLayout({ children, expired }: Props) {
  const { allowedSections, expiresAt } = useGuest();

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
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-semibold text-foreground">Healthcare Records — Read Only Access</h2>
        {expiresAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            This link expires on {new Date(expiresAt).toLocaleDateString()}
          </p>
        )}
      </header>
      <nav className="flex flex-wrap gap-3 mb-6">
        {allowedSections.map((s) => (
          <Link
            key={s}
            to={`/guest/sections/${s}`}
            className="text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            {SECTION_LABELS[s] ?? s}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
