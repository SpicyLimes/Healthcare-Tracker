import RecordList, { type Column, type Field } from "../components/RecordList";
import { medicationsApi, type Medication } from "../api/medications";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";

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
  const isAdmin = user?.role === "admin";
  return (
    <RecordList
      title="Medications"
      api={medicationsApi}
      columns={columns}
      fields={fields}
      isAdmin={isAdmin}
      renderRowExtra={(row) => (
        <DocumentsPanel section="medications" recordId={row.id} isAdmin={isAdmin} />
      )}
    />
  );
}
