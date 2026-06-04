import { useEffect, useState, type FormEvent } from "react";
import { getProfile, saveProfile, type ProfileInput } from "../api/profile";
import { useAuth } from "../auth/useAuth";

const EMPTY: ProfileInput = {
  full_name: "",
  date_of_birth: null,
  blood_type: null,
  allergies: null,
  emergency_contacts: null,
  primary_language: null,
  notes: null,
};

const TEXT_FIELDS: { name: keyof ProfileInput; label: string; type?: string }[] = [
  { name: "full_name", label: "Full name" },
  { name: "date_of_birth", label: "Date of birth", type: "date" },
  { name: "blood_type", label: "Blood type" },
  { name: "primary_language", label: "Primary language" },
];

const AREA_FIELDS: { name: keyof ProfileInput; label: string }[] = [
  { name: "allergies", label: "Allergies" },
  { name: "emergency_contacts", label: "Emergency contacts" },
  { name: "notes", label: "Notes" },
];

function fieldValue(v: string | null | undefined): string {
  return v ?? "";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setForm({
            full_name: p.full_name,
            date_of_birth: p.date_of_birth ?? null,
            blood_type: p.blood_type ?? null,
            allergies: p.allergies ?? null,
            emergency_contacts: p.emergency_contacts ?? null,
            primary_language: p.primary_language ?? null,
            notes: p.notes ?? null,
          });
        }
      })
      .catch(() => setError("Failed to load profile"));
  }, []);

  function set<K extends keyof ProfileInput>(key: K, value: string) {
    setForm((s) => ({ ...s, [key]: value === "" ? null : value }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== null && v !== ""),
      ) as unknown as ProfileInput;
      payload.full_name = form.full_name;
      await saveProfile(payload);
      setSaved(true);
    } catch {
      setError("Could not save profile");
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Profile</h1>
      {error && <p role="alert">{error}</p>}
      {saved && <p>Saved.</p>}
      <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "28rem" }}>
        {TEXT_FIELDS.map((f) => (
          <label key={f.name} style={{ display: "flex", flexDirection: "column" }}>
            {f.label}
            <input
              type={f.type ?? "text"}
              required={f.name === "full_name"}
              disabled={!isAdmin}
              value={fieldValue(form[f.name] as string | null | undefined)}
              onChange={(e) => set(f.name, e.target.value)}
            />
          </label>
        ))}
        {AREA_FIELDS.map((f) => (
          <label key={f.name} style={{ display: "flex", flexDirection: "column" }}>
            {f.label}
            <textarea
              disabled={!isAdmin}
              value={fieldValue(form[f.name] as string | null | undefined)}
              onChange={(e) => set(f.name, e.target.value)}
            />
          </label>
        ))}
        {isAdmin && <button type="submit">Save</button>}
      </form>
    </main>
  );
}
