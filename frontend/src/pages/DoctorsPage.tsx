import RecordList, { type Column, type Field } from "../components/RecordList";
import { doctorsApi, type Doctor } from "../api/doctors";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";

const columns: Column<Doctor>[] = [
  { header: "Name", render: (d) => d.name },
  { header: "Specialty", render: (d) => d.specialty ?? "" },
  { header: "Practice", render: (d) => d.practice ?? "" },
  { header: "Phone", render: (d) => d.phone ?? "" },
];

const fields: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "specialty", label: "Specialty" },
  { name: "practice", label: "Practice" },
  { name: "phone", label: "Phone" },
];

export default function DoctorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <RecordList
      title="Doctors & Specialists"
      api={doctorsApi}
      columns={columns}
      fields={fields}
      isAdmin={isAdmin}
      renderRowExtra={(row) => (
        <DocumentsPanel section="doctors" recordId={row.id} isAdmin={isAdmin} />
      )}
    />
  );
}
