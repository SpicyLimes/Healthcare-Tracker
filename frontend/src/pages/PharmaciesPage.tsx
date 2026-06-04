import RecordList, { type Column, type Field } from "../components/RecordList";
import { pharmaciesApi, type Pharmacy } from "../api/pharmacies";
import { useAuth } from "../auth/useAuth";

const columns: Column<Pharmacy>[] = [
  { header: "Name", render: (r) => r.name },
  { header: "Phone", render: (r) => r.phone ?? "" },
  { header: "Address", render: (r) => r.address ?? "" },
];

const fields: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address" },
];

export default function PharmaciesPage() {
  const { user } = useAuth();
  return <RecordList title="Pharmacies" api={pharmaciesApi} columns={columns} fields={fields} isAdmin={user?.role === "admin"} />;
}
