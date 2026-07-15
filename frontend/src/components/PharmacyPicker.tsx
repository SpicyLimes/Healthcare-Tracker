// frontend/src/components/PharmacyPicker.tsx
import { useEffect, useState } from "react";
import { pharmaciesApi, type Pharmacy } from "../api/pharmacies";
import { Select } from "@/components/ui/form-field";

interface PharmacyPickerProps {
  pharmacyId: string | null;
  onChange: (pharmacyId: string | null) => void;
  disabled?: boolean;
}

// Dropdown-only (no free-text "Other"): pharmacies live on the Pharmacies page.
export default function PharmacyPicker({ pharmacyId, onChange, disabled }: PharmacyPickerProps) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);

  useEffect(() => {
    pharmaciesApi.list().then(setPharmacies).catch(() => {});
  }, []);

  return (
    <Select
      value={pharmacyId ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      aria-label="Select pharmacy"
    >
      <option value="">Select a Pharmacy…</option>
      {pharmacies.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </Select>
  );
}
