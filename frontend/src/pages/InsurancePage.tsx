import RecordList, { type Column, type Field } from "../components/RecordList";
import { insurancesApi, type Insurance } from "../api/insurances";
import { useAuth } from "../auth/useAuth";

const columns: Column<Insurance>[] = [
  { header: "Insurer", render: (r) => r.insurer_name },
  { header: "Policy #", render: (r) => r.policy_number ?? "" },
  { header: "Group #", render: (r) => r.group_number ?? "" },
  { header: "Phone", render: (r) => r.contact_phone ?? "" },
];

const fields: Field[] = [
  { name: "insurer_name", label: "Insurer name", required: true },
  { name: "policy_number", label: "Policy #" },
  { name: "group_number", label: "Group #" },
  { name: "contact_phone", label: "Phone" },
];

export default function InsurancePage() {
  const { user } = useAuth();
  return <RecordList title="Insurance" api={insurancesApi} columns={columns} fields={fields} isAdmin={user?.role === "admin"} />;
}
