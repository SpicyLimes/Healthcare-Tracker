// frontend/src/pages/GuestEntryPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getGuestSections } from "../api/guest";
import { useGuest } from "../auth/GuestContext";
import GuestLayout from "../components/GuestLayout";

const ALL_SECTIONS = [
  "surgeries", "hospitalizations", "vision_history", "dental_history",
  "visit_logs", "appointments", "medications", "vaccinations",
  "insurances", "ailments", "doctors", "profile",
];

export default function GuestEntryPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { setGuest } = useGuest();
  const navigate = useNavigate();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!token) { setExpired(true); return; }
    getGuestSections(token)
      .then((sections) => {
        const allowed = sections.length > 0 ? sections : ALL_SECTIONS;
        let expiresAt = "";
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          expiresAt = new Date(payload.exp * 1000).toISOString();
        } catch { /* ignore */ }
        setGuest(token, allowed, expiresAt);
        navigate(`/guest/sections/${allowed[0]}?token=${encodeURIComponent(token)}`, { replace: true });
      })
      .catch(() => setExpired(true));
  }, [token]);

  if (expired) return <GuestLayout expired>{null}</GuestLayout>;
  return <p style={{ fontFamily: "system-ui", padding: "2rem" }}>Loading…</p>;
}
