import { useEffect, useState, type FormEvent } from "react";
import { getProfile, saveProfile, type ProfileInput } from "../api/profile";
import { vitalsApi } from "../api/vitals";
import { doctorsApi, type Doctor } from "../api/doctors";
import { formatDate } from "@/lib/format";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea, Select } from "@/components/ui/form-field";
import { parseContacts, parseAllergies, type EmergencyContact, type Allergy } from "@/lib/profile-parsers";

const RELATIONSHIP_OPTIONS = [
  "Spouse/Partner", "Parent", "Child", "Sibling",
  "Family Member", "Caregiver", "Friend", "Other",
];

function serializeAllergies(list: Allergy[]): string | null {
  const nonEmpty = list.filter(
    (a) => a.medication.trim() || a.reaction.trim() || a.age_of_onset.trim()
  );
  if (nonEmpty.length === 0) return null;
  return JSON.stringify(nonEmpty);
}

function serializeContacts(contacts: EmergencyContact[]): string | null {
  const nonEmpty = contacts.filter(
    (c) => c.name.trim() || c.phone.trim() || c.email.trim()
  );
  if (nonEmpty.length === 0) return null;
  return JSON.stringify(nonEmpty);
}

function inchesToDisplay(inches: number): string {
  const totalInches = Math.round(inches);
  const ft = Math.floor(totalInches / 12);
  const remaining = totalInches % 12;
  return `${ft}'${remaining}"`;
}

function lbsToDisplay(lbs: number): string {
  return `${Math.round(lbs)} lbs`;
}

const EMPTY: ProfileInput = {
  full_name: "",
  date_of_birth: null,
  blood_type: null,
  allergies: null,
  emergency_contacts: null,
  primary_language: null,
  height: null,
  weight: null,
  phone: null,
  notes: null,
  main_doctor_id: null,
};

function fieldValue(v: string | null | undefined): string {
  return v ?? "";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [allergyList, setAllergyList] = useState<Allergy[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [mainDoctorId, setMainDoctorId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [vitalsHeightHint, setVitalsHeightHint] = useState<string | null>(null);
  const [vitalsWeightHint, setVitalsWeightHint] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setProfileId(p.id);
          setForm((prev) => ({
            full_name: p.full_name,
            date_of_birth: p.date_of_birth ?? null,
            blood_type: p.blood_type ?? null,
            allergies: p.allergies ?? null,
            emergency_contacts: p.emergency_contacts ?? null,
            primary_language: p.primary_language ?? null,
            height: p.height ?? prev.height,
            weight: p.weight ?? prev.weight,
            phone: p.phone ?? null,
            notes: p.notes ?? null,
            main_doctor_id: p.main_doctor_id ?? null,
          }));
          setContacts(parseContacts(p.emergency_contacts));
          setAllergyList(parseAllergies(p.allergies ?? null));
          setMainDoctorId(p.main_doctor_id ?? null);
        }
      })
      .catch(() => setError("Failed to load profile"));

    doctorsApi.list().then(setDoctors).catch(() => {});

    vitalsApi.list().then((allVitals) => {
      const sorted = [...allVitals].sort(
        (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
      );

      const withHeight = sorted.find((v) => v.height_in != null);
      if (withHeight?.height_in != null) {
        const display = inchesToDisplay(withHeight.height_in);
        const dateStr = formatDate(withHeight.measured_at);
        setVitalsHeightHint(`Latest from Vitals: ${display} (${dateStr})`);
        setForm((prev) => ({
          ...prev,
          height: prev.height ?? display,
        }));
      }

      const withWeight = sorted.find((v) => v.weight_lb != null);
      if (withWeight?.weight_lb != null) {
        const display = lbsToDisplay(withWeight.weight_lb);
        const dateStr = formatDate(withWeight.measured_at);
        setVitalsWeightHint(`Latest from Vitals: ${display} (${dateStr})`);
        setForm((prev) => ({
          ...prev,
          weight: prev.weight ?? display,
        }));
      }
    }).catch(() => {
      // Vitals fetch failure is non-fatal — profile still loads
    });
  }, []);

  function set<K extends keyof ProfileInput>(key: K, value: string) {
    setForm((s) => ({ ...s, [key]: value === "" ? null : value }));
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: "", relationship: "", phone: "", email: "" }]);
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  function setContact(index: number, field: keyof EmergencyContact, value: string) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function addAllergy() {
    setAllergyList((prev) => [...prev, { medication: "", reaction: "", age_of_onset: "" }]);
  }

  function removeAllergy(index: number) {
    setAllergyList((prev) => prev.filter((_, i) => i !== index));
  }

  function setAllergy(index: number, field: keyof Allergy, value: string) {
    setAllergyList((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== null && v !== ""),
      ) as unknown as ProfileInput;
      payload.full_name = form.full_name;
      // These override the raw JSON strings that form state carries from load:
      payload.emergency_contacts = serializeContacts(contacts);
      payload.allergies = serializeAllergies(allergyList);
      payload.main_doctor_id = mainDoctorId;
      const result = await saveProfile(payload);
      setProfileId(result.id);
      setSaved(true);
    } catch {
      setError("Could not save profile");
    }
  }

  return (
    <AppShell>
      <PageLayout title="Profile" description="Personal information and health details.">
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mb-4 text-sm text-primary">Saved successfully.</p>
        )}

        <form onSubmit={onSave} className="flex flex-col gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <FormField label="Full name" htmlFor="full_name">
                    <Input
                      id="full_name"
                      type="text"
                      required
                      disabled={!isAdmin}
                      value={fieldValue(form.full_name)}
                      onChange={(e) => set("full_name", e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </FormField>
                </div>

                {/* Date of Birth | Blood Type */}
                <FormField label="Date of Birth" htmlFor="date_of_birth">
                  <Input
                    id="date_of_birth"
                    type="date"
                    disabled={!isAdmin}
                    value={fieldValue(form.date_of_birth)}
                    onChange={(e) => set("date_of_birth", e.target.value)}
                  />
                </FormField>
                <FormField label="Blood Type" htmlFor="blood_type">
                  <Select
                    id="blood_type"
                    disabled={!isAdmin}
                    value={fieldValue(form.blood_type)}
                    onChange={(e) => set("blood_type", e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </Select>
                </FormField>

                {/* Main Doctor */}
                <FormField label="Main Doctor" htmlFor="main_doctor">
                  {isAdmin ? (
                    <Select
                      id="main_doctor"
                      value={mainDoctorId ?? ""}
                      onChange={(e) => setMainDoctorId(e.target.value === "" ? null : e.target.value)}
                    >
                      <option value="">— Not set —</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.specialty ? ` (${d.specialty})` : ""}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-sm text-foreground">
                      {(() => {
                        const d = doctors.find((doc) => doc.id === mainDoctorId);
                        if (!d) return "Not set";
                        return d.specialty ? `${d.name} (${d.specialty})` : d.name;
                      })()}
                    </p>
                  )}
                </FormField>

                {/* Height | Weight — Vitals prefill wired in Task 2 */}
                <FormField label="Height" htmlFor="height">
                  <Input
                    id="height"
                    type="text"
                    disabled={!isAdmin}
                    value={fieldValue(form.height)}
                    onChange={(e) => set("height", e.target.value)}
                    placeholder={`e.g. 5'10"`}
                  />
                  {vitalsHeightHint && (
                    <p className="mt-1 text-xs text-muted-foreground">{vitalsHeightHint}</p>
                  )}
                </FormField>
                <FormField label="Weight" htmlFor="weight">
                  <Input
                    id="weight"
                    type="text"
                    disabled={!isAdmin}
                    value={fieldValue(form.weight)}
                    onChange={(e) => set("weight", e.target.value)}
                    placeholder="e.g. 170 lbs"
                  />
                  {vitalsWeightHint && (
                    <p className="mt-1 text-xs text-muted-foreground">{vitalsWeightHint}</p>
                  )}
                </FormField>

                {/* Phone | Primary Language */}
                <FormField label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="text"
                    disabled={!isAdmin}
                    value={fieldValue(form.phone)}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="e.g. +1 555-555-5555"
                  />
                </FormField>
                <FormField label="Primary Language" htmlFor="primary_language">
                  <Input
                    id="primary_language"
                    type="text"
                    disabled={!isAdmin}
                    value={fieldValue(form.primary_language)}
                    onChange={(e) => set("primary_language", e.target.value)}
                    placeholder="e.g. English"
                  />
                </FormField>

                {/* Allergies */}
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-medium text-foreground">Allergies</p>
                  <div className="flex flex-col gap-3">
                    {allergyList.length === 0 && !isAdmin && (
                      <p className="text-sm text-muted-foreground">No allergies on file.</p>
                    )}
                    {allergyList.map((a, i) =>
                      isAdmin ? (
                        <div key={i} className="relative rounded-lg border border-border bg-muted/20 p-4">
                          <button
                            type="button"
                            aria-label={`Remove allergy ${i + 1}`}
                            onClick={() => removeAllergy(i)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <FormField label="Medication" htmlFor={`al-med-${i}`}>
                              <Input
                                id={`al-med-${i}`}
                                type="text"
                                placeholder="Medication"
                                value={a.medication}
                                onChange={(e) => setAllergy(i, "medication", e.target.value)}
                              />
                            </FormField>
                            <FormField label="Reaction" htmlFor={`al-rxn-${i}`}>
                              <Input
                                id={`al-rxn-${i}`}
                                type="text"
                                placeholder="Reaction"
                                value={a.reaction}
                                onChange={(e) => setAllergy(i, "reaction", e.target.value)}
                              />
                            </FormField>
                            <FormField label="Age of Onset" htmlFor={`al-age-${i}`}>
                              <Input
                                id={`al-age-${i}`}
                                type="number"
                                min={0}
                                max={120}
                                placeholder="Age"
                                value={a.age_of_onset}
                                onChange={(e) => setAllergy(i, "age_of_onset", e.target.value)}
                              />
                            </FormField>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
                            <div><span className="text-muted-foreground">Medication: </span><span className="text-foreground">{a.medication || "—"}</span></div>
                            <div><span className="text-muted-foreground">Reaction: </span><span className="text-foreground">{a.reaction || "—"}</span></div>
                            <div><span className="text-muted-foreground">Age of Onset: </span><span className="text-foreground">{a.age_of_onset || "—"}</span></div>
                          </div>
                        </div>
                      )
                    )}
                    {isAdmin && (
                      <Button type="button" variant="outline" size="sm" onClick={addAllergy} className="self-start">
                        + Add Allergy
                      </Button>
                    )}
                  </div>
                </div>

                {/* Emergency Contacts */}
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-medium text-foreground">Emergency Contacts</p>
                  <div className="flex flex-col gap-3">
                    {contacts.length === 0 && !isAdmin && (
                      <p className="text-sm text-muted-foreground">No emergency contacts on file.</p>
                    )}
                    {contacts.map((c, i) =>
                      isAdmin ? (
                        <div key={i} className="relative rounded-lg border border-border bg-muted/20 p-4">
                          <button
                            type="button"
                            aria-label={`Remove contact ${i + 1}`}
                            onClick={() => removeContact(i)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FormField label="Name" htmlFor={`ec-name-${i}`}>
                              <Input
                                id={`ec-name-${i}`}
                                type="text"
                                placeholder="Name"
                                value={c.name}
                                onChange={(e) => setContact(i, "name", e.target.value)}
                              />
                            </FormField>
                            <FormField label="Relationship" htmlFor={`ec-rel-${i}`}>
                              <Select
                                id={`ec-rel-${i}`}
                                value={c.relationship}
                                onChange={(e) => setContact(i, "relationship", e.target.value)}
                              >
                                <option value="">— Select —</option>
                                {RELATIONSHIP_OPTIONS.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </Select>
                            </FormField>
                            <FormField label="Phone" htmlFor={`ec-phone-${i}`}>
                              <Input
                                id={`ec-phone-${i}`}
                                type="text"
                                placeholder="Phone"
                                value={c.phone}
                                onChange={(e) => setContact(i, "phone", e.target.value)}
                              />
                            </FormField>
                            <FormField label="Email" htmlFor={`ec-email-${i}`}>
                              <Input
                                id={`ec-email-${i}`}
                                type="text"
                                placeholder="Email"
                                value={c.email}
                                onChange={(e) => setContact(i, "email", e.target.value)}
                              />
                            </FormField>
                          </div>
                        </div>
                      ) : (
                        // Viewer: read-only card
                        <div key={i} className="rounded-lg border border-border bg-muted/20 p-4">
                          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                            <div><span className="text-muted-foreground">Name: </span><span className="text-foreground">{c.name || "—"}</span></div>
                            <div><span className="text-muted-foreground">Relationship: </span><span className="text-foreground">{c.relationship || "—"}</span></div>
                            <div><span className="text-muted-foreground">Phone: </span><span className="text-foreground">{c.phone || "—"}</span></div>
                            <div><span className="text-muted-foreground">Email: </span><span className="text-foreground">{c.email || "—"}</span></div>
                          </div>
                        </div>
                      )
                    )}
                    {isAdmin && (
                      <Button type="button" variant="outline" size="sm" onClick={addContact} className="self-start">
                        + Add Contact
                      </Button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <FormField label="Notes" htmlFor="notes">
                    <Textarea
                      id="notes"
                      disabled={!isAdmin}
                      value={fieldValue(form.notes)}
                      onChange={(e) => set("notes", e.target.value)}
                      placeholder="Additional notes..."
                    />
                  </FormField>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <div className="flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          )}
        </form>

        {profileId && (
          <div className="mt-8">
            <DocumentsPanel section="profile" recordId={profileId} isAdmin={isAdmin} />
          </div>
        )}
      </PageLayout>
    </AppShell>
  );
}
