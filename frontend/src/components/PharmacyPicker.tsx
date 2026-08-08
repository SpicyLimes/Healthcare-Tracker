// frontend/src/components/PharmacyPicker.tsx
import { useEffect, useState } from "react";
import { pharmaciesApi, type Pharmacy } from "../api/pharmacies";
import { Select, Input } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";

interface PharmacyPickerProps {
  pharmacyId: string | null;
  onChange: (pharmacyId: string | null) => void;
  disabled?: boolean;
}

export default function PharmacyPicker({ pharmacyId, onChange, disabled }: PharmacyPickerProps) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  // Inline creation. Without it, discovering the pharmacy is missing mid-form
  // meant leaving for the Pharmacies page and losing everything typed so far —
  // the modal closes on backdrop click with no dirty check.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    pharmaciesApi.list().then(setPharmacies).catch(() => {});
  }, []);

  async function createPharmacy() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setAddError("");
    try {
      const created = await pharmaciesApi.create({ name } as Parameters<typeof pharmaciesApi.create>[0]);
      setPharmacies((prev) => [...prev, created]);
      onChange(created.id);
      setAdding(false);
      setNewName("");
    } catch {
      setAddError("Could not add pharmacy");
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            autoFocus
            type="text"
            value={newName}
            disabled={saving}
            placeholder="Pharmacy name"
            aria-label="New pharmacy name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              // Enter must not submit the surrounding record form.
              if (e.key === "Enter") { e.preventDefault(); void createPharmacy(); }
              if (e.key === "Escape") { e.preventDefault(); setAdding(false); setNewName(""); }
            }}
          />
          <Button type="button" size="sm" disabled={saving || !newName.trim()} onClick={() => void createPharmacy()}>
            {saving ? "Adding…" : "Add"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={saving}
            onClick={() => { setAdding(false); setNewName(""); setAddError(""); }}>
            Cancel
          </Button>
        </div>
        {addError && <p role="alert" className="text-xs text-destructive">{addError}</p>}
      </div>
    );
  }

  return (
    <Select
      value={pharmacyId ?? ""}
      onChange={(e) => {
        if (e.target.value === "__add__") { setAdding(true); return; }
        onChange(e.target.value || null);
      }}
      disabled={disabled}
      aria-label="Select pharmacy"
    >
      <option value="">Select a Pharmacy…</option>
      {pharmacies.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
      <option value="__add__">+ Add new pharmacy…</option>
    </Select>
  );
}
