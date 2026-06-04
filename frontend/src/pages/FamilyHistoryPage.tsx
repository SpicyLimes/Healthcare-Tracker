import RecordList, { type Column, type Field } from "../components/RecordList";
import { familyHistoryApi, type FamilyHistory } from "../api/familyHistory";
import { useAuth } from "../auth/useAuth";

const columns: Column<FamilyHistory>[] = [
  { header: "Relative", render: (r) => r.relative },
  { header: "Condition", render: (r) => r.condition },
  { header: "Age of onset", render: (r) => r.age_of_onset ?? "" },
];

const fields: Field[] = [
  { name: "relative", label: "Relative", required: true },
  { name: "condition", label: "Condition", required: true },
  { name: "age_of_onset", label: "Age of onset" },
];

export default function FamilyHistoryPage() {
  const { user } = useAuth();
  return <RecordList title="Family health history" api={familyHistoryApi} columns={columns} fields={fields} isAdmin={user?.role === "admin"} />;
}
