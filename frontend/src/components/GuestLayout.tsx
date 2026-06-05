// frontend/src/components/GuestLayout.tsx
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  const { token, allowedSections, expiresAt } = useGuest();
  const [searchParams] = useSearchParams();
  const rawToken = token || searchParams.get("token") || "";

  if (expired) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "2rem", textAlign: "center" }}>
        <h1>Link Expired or Revoked</h1>
        <p>This share link is no longer valid. Please contact the person who shared it with you.</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <header style={{ borderBottom: "1px solid #ccc", marginBottom: "1rem", paddingBottom: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>Healthcare Records — Read Only Access</h2>
        {expiresAt && (
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#666" }}>
            This link expires on {new Date(expiresAt).toLocaleDateString()}
          </p>
        )}
      </header>
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {allowedSections.map((s) => (
          <Link key={s} to={`/guest/sections/${s}?token=${encodeURIComponent(rawToken)}`}>
            {SECTION_LABELS[s] ?? s}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
