// frontend/src/components/DoctorPicker.tsx
import { useEffect, useState } from "react";
import { doctorsApi, type Doctor } from "../api/doctors";
import { Select, Input } from "@/components/ui/form-field";

interface DoctorPickerProps {
  doctorId: string | null;
  doctorOther: string | null;
  onChange: (doctorId: string | null, doctorOther: string | null) => void;
  disabled?: boolean;
}

export default function DoctorPicker({ doctorId, doctorOther, onChange, disabled }: DoctorPickerProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showOther, setShowOther] = useState(doctorId === null && doctorOther !== null);

  useEffect(() => {
    doctorsApi.list().then(setDoctors).catch(() => {});
  }, []);

  // Sync showOther when parent changes doctorOther externally (e.g., form reset or record load)
  useEffect(() => {
    setShowOther(doctorId === null && doctorOther !== null);
  }, [doctorId, doctorOther]);

  const selectValue = doctorId ?? (showOther ? "__other__" : "");

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
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

  return (
    <div className="flex flex-col gap-2">
      <Select value={selectValue} onChange={handleSelect} disabled={disabled}>
        <option value="">Select a Doctor…</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
        <option value="__other__">Other</option>
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
