// frontend/src/components/DoctorPicker.tsx
import { useEffect, useState } from "react";
import { doctorsApi, type Doctor } from "../api/doctors";
import { Select, Input } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";

interface DoctorPickerProps {
  doctorId: string | null;
  doctorOther: string | null;
  onChange: (doctorId: string | null, doctorOther: string | null) => void;
  disabled?: boolean;
}

export default function DoctorPicker({ doctorId, doctorOther, onChange, disabled }: DoctorPickerProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showOther, setShowOther] = useState(doctorId === null && doctorOther !== null);
  // Inline creation, so a missing doctor doesn't force abandoning the form.
  // "Other" stays: it records a name without creating a Doctor record.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  // Sync showOther when parent changes doctorOther externally (e.g., form reset or record load)
  useEffect(() => {
    setShowOther(doctorId === null && doctorOther !== null);
  }, [doctorId, doctorOther]);

  const selectValue = doctorId ?? (showOther ? "__other__" : "");

  async function createDoctor() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setAddError("");
    try {
      const created = await doctorsApi.create({ name } as Parameters<typeof doctorsApi.create>[0]);
      setDoctors((prev) => [...prev, created]);
      setShowOther(false);
      onChange(created.id, null);
      setAdding(false);
      setNewName("");
    } catch {
      setAddError("Could not add doctor");
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "__add__") {
      setAdding(true);
      return;
    }
    if (val === "__other__") {
      setShowOther(true);
      onChange(null, "");
    } else if (val === "") {
      setShowOther(false);
      onChange(null, null);
    } else {
      setShowOther(false);
      onChange(val, null);
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
            placeholder="Doctor name"
            aria-label="New doctor name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              // Enter must not submit the surrounding record form.
              if (e.key === "Enter") { e.preventDefault(); void createDoctor(); }
              if (e.key === "Escape") { e.preventDefault(); setAdding(false); setNewName(""); }
            }}
          />
          <Button type="button" size="sm" disabled={saving || !newName.trim()} onClick={() => void createDoctor()}>
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
    <div className="flex flex-col gap-2">
      <Select value={selectValue} onChange={handleSelect} disabled={disabled} aria-label="Select doctor">
        <option value="">Select a Doctor…</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
        <option value="__other__">Other</option>
        <option value="__add__">+ Add new doctor…</option>
      </Select>
      {showOther && (
        <Input
          type="text"
          value={doctorOther ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(null, e.target.value)}
          placeholder="Doctor name"
        />
      )}
    </div>
  );
}
