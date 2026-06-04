import RecordList, { type Column, type Field } from "../components/RecordList";
import { medicationsApi, type Medication } from "../api/medications";
import { useAuth } from "../auth/useAuth";

const columns: Column<Medication>[] = [
  { header: "Name", render: (m) => m.name },
  { header: "Kind", render: (m) => m.kind },
  { header: "Dose", render: (m) => m.dose ?? "" },
  { header: "Frequency", render: (m) => m.frequency ?? "" },
  { header: "Active", render: (m) => (m.is_active ? "yes" : "no") },
];

const fields: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "dose", label: "Dose" },
  { name: "frequency", label: "Frequency" },
  { name: "prescribing_doctor", label: "Prescribing doctor" },
];

export default function MedicationsPage() {
  const { user } = useAuth();
  return (
    <RecordList
      title="Medications"
      api={medicationsApi}
      columns={columns}
      fields={fields}
      isAdmin={user?.role === "admin"}
    />
  );
}
