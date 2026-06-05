import RecordList, { type Column, type Field } from "../components/RecordList";
import { ailmentsApi, type Ailment } from "../api/ailments";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";

const columns: Column<Ailment>[] = [
  { header: "Condition", render: (a) => a.condition },
  { header: "Status", render: (a) => a.status },
  { header: "Onset", render: (a) => a.onset_date ?? "" },
  { header: "Treating doctor", render: (a) => a.treating_doctor ?? "" },
];

const fields: Field[] = [
  { name: "condition", label: "Condition", required: true },
  { name: "onset_date", label: "Onset date", type: "date" },
  { name: "treating_doctor", label: "Treating doctor" },
];

export default function AilmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <RecordList
      title="Ailment History"
      api={ailmentsApi}
      columns={columns}
      fields={fields}
      isAdmin={isAdmin}
      renderRowExtra={(row) => (
        <DocumentsPanel section="ailments" recordId={row.id} isAdmin={isAdmin} />
      )}
    />
  );
}
