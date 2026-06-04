// frontend/src/components/DoctorPicker.tsx
import { useEffect, useState } from "react";
import { doctorsApi, type Doctor } from "../api/doctors";

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

  const selectValue = doctorId ?? (showOther ? "__other__" : "");
  const otherValue = doctorOther ?? "";

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
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
      <select value={selectValue} onChange={handleSelect} disabled={disabled}>
        <option value="">— none —</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
        <option value="__other__">Other</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={otherValue}
          disabled={disabled}
          onChange={(e) => onChange(null, e.target.value)}
          placeholder="Doctor name"
        />
      )}
    </span>
  );
}
