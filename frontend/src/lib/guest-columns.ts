/**
 * Which columns a guest (a clinician reading a share link) sees per section.
 *
 * Previously the guest table took `Object.keys(rows[0]).slice(0, 4)` — so the
 * columns were whatever Pydantic happened to serialise first, and a backend
 * field reorder silently rewrote what the doctor saw. On visit_logs that meant
 * showing `visit_type`/`visit_date`/`visit_time`/`doctor_other` while hiding
 * `reason` and `summary`: a date and "in_person", with no indication what the
 * visit was actually about.
 *
 * Capped at 6 columns. This is a 60-second document — more columns is not more
 * useful, it is less readable. Anything omitted here is still one click away in
 * the record detail view.
 *
 * Ordered by clinical value: what identifies the record, then what a clinician
 * needs to act on.
 */
export const GUEST_COLUMNS: Record<string, string[]> = {
  // `used_for` displaces `route` rather than becoming a 7th column: the list is
  // capped at MAX_GUEST_COLUMNS, so an extra entry would silently drop Status
  // off the end. Route is still one click away in the record detail.
  medications: ["name", "used_for", "dose", "frequency", "prescribing_doctor", "is_active"],
  ailments: ["condition", "status", "onset_date", "treating_doctor", "notes"],
  visit_logs: ["visit_date", "visit_type", "doctor", "reason", "summary", "follow_up_date"],
  vitals: ["measured_at", "bp_systolic", "bp_diastolic", "pulse_bpm", "weight_lb", "temperature_f"],
  surgeries: ["procedure", "surgery_date", "procedure_type", "surgeon", "hospital", "outcome"],
  hospitalizations: [
    "facility", "admission_date", "discharge_date", "attending_physician", "reason", "outcome",
  ],
  appointments: ["appointment_datetime", "appointment_type", "doctor", "status", "location", "notes"],
  vaccinations: ["vaccine", "administered_date", "manufacturer", "administrator", "next_due_date"],
  vision_history: ["visit_date", "provider", "rx_od", "rx_os", "notes"],
  dental_history: ["visit_date", "provider", "procedure", "notes"],
  doctors: ["name", "specialty", "practice", "phone", "address"],
  pharmacies: ["name", "phone", "address", "notes"],
  insurances: ["insurer_name", "policy_number", "group_number", "contact_phone", "is_active"],
  family_history: ["relative", "condition", "age_of_onset", "notes"],
  profile: ["full_name", "date_of_birth", "blood_type", "allergies", "emergency_contacts"],
};

/** Hard ceiling — a doctor-facing table stays readable. */
export const MAX_GUEST_COLUMNS = 6;

/**
 * Column headers. CSS `capitalize` on a snake_case key produced "Spo2",
 * "Bp Systolic" and "Rx Od" — clinical abbreviations mangled into something a
 * clinician has to decode. These spell them the way a chart does.
 */
const FIELD_LABELS: Record<string, string> = {
  spo2: "SpO₂",
  bp_systolic: "BP Systolic",
  bp_diastolic: "BP Diastolic",
  pulse_bpm: "Pulse (bpm)",
  height_in: "Height (in)",
  weight_lb: "Weight (lb)",
  temperature_f: "Temp (°F)",
  respiratory_rate: "Respiratory Rate",
  blood_glucose: "Blood Glucose",
  measured_at: "Measured",
  rx_od: "Rx (OD)",
  rx_os: "Rx (OS)",
  date_of_birth: "Date of Birth",
  is_active: "Status",
  visit_type: "Visit Type",
  follow_up_date: "Follow-up",
  appointment_datetime: "When",
  appointment_type: "Type",
  administered_date: "Administered",
  next_due_date: "Next Due",
  insurer_name: "Insurer",
  policy_number: "Policy #",
  group_number: "Group #",
  contact_phone: "Phone",
  age_of_onset: "Age of Onset",
  emergency_contacts: "Emergency Contacts",
  prescribing_doctor: "Prescriber",
  treating_doctor: "Treating Doctor",
  attending_physician: "Attending Physician",
};

/** Human label for a field key. */
export function fieldLabel(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Columns to show for a section, given the keys actually present on a row.
 * Falls back to the previous behaviour (first N non-id keys) for any section
 * without an explicit config, so a newly added section degrades rather than
 * rendering blank.
 */
export function guestColumns(section: string, row: Record<string, unknown> | undefined): string[] {
  if (!row) return [];
  const configured = GUEST_COLUMNS[section];
  if (configured) {
    // Keep only keys the payload really has, so a schema change can't produce
    // a column of empty cells.
    return configured.filter((k) => k in row).slice(0, MAX_GUEST_COLUMNS);
  }
  return Object.keys(row)
    .filter((k) => k !== "id" && !k.endsWith("_id"))
    .slice(0, MAX_GUEST_COLUMNS);
}
