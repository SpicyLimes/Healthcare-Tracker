import RecordList, { type Column, type Field } from "../components/RecordList";
import { vaccinationsApi, type Vaccination } from "../api/vaccinations";
import { useAuth } from "../auth/useAuth";

const columns: Column<Vaccination>[] = [
  { header: "Vaccine", render: (r) => r.vaccine },
  { header: "Date", render: (r) => r.administered_date ?? "" },
  { header: "Next due", render: (r) => r.next_due_date ?? "" },
  { header: "Administrator", render: (r) => r.administrator ?? "" },
];

const fields: Field[] = [
  { name: "vaccine", label: "Vaccine", required: true },
  { name: "administered_date", label: "Administered date", type: "date" },
  { name: "lot_number", label: "Lot #" },
  { name: "administrator", label: "Administrator" },
  { name: "next_due_date", label: "Next due date", type: "date" },
];

export default function VaccinationsPage() {
  const { user } = useAuth();
  return <RecordList title="Vaccinations" api={vaccinationsApi} columns={columns} fields={fields} isAdmin={user?.role === "admin"} />;
}
