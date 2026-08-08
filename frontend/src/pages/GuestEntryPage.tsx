import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getGuestSections } from "../api/guest";
import { useGuest } from "../auth/GuestContext";
import GuestLayout from "../components/GuestLayout";
import { landingSection } from "@/lib/section-labels";

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
        // Empty sections from API means no access, not all access
        if (sections.length === 0) { setExpired(true); return; }
        let expiresAt = "";
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          expiresAt = new Date(payload.exp * 1000).toISOString();
        } catch { /* ignore */ }
        setGuest(token, sections, expiresAt);
        // Land on the highest-value section available, not sections[0] —
        // which was whichever checkbox the sender happened to click first.
        const landing = landingSection(sections) ?? sections[0];
        // Navigate WITHOUT token in URL — token lives in context state only
        navigate(`/guest/sections/${landing}`, { replace: true });
      })
      .catch(() => setExpired(true));
  }, [token]);

  if (expired) return <GuestLayout expired>{null}</GuestLayout>;
  return <p style={{ fontFamily: "system-ui", padding: "2rem" }}>Loading…</p>;
}
