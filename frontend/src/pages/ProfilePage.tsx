import { useEffect, useState, type FormEvent } from "react";
import { getProfile, saveProfile, type ProfileInput } from "../api/profile";
import { useAuth } from "../auth/useAuth";
import DocumentsPanel from "../components/DocumentsPanel";
import { AppShell } from "@/components/app-shell";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea, Select } from "@/components/ui/form-field";

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
};

function fieldValue(v: string | null | undefined): string {
  return v ?? "";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setProfileId(p.id);
          setForm({
            full_name: p.full_name,
            date_of_birth: p.date_of_birth ?? null,
            blood_type: p.blood_type ?? null,
            allergies: p.allergies ?? null,
            emergency_contacts: p.emergency_contacts ?? null,
            primary_language: p.primary_language ?? null,
            height: p.height ?? null,
            weight: p.weight ?? null,
            phone: p.phone ?? null,
            notes: p.notes ?? null,
          });
        }
      })
      .catch(() => setError("Failed to load profile"));
  }, []);

  function set<K extends keyof ProfileInput>(key: K, value: string) {
    setForm((s) => ({ ...s, [key]: value === "" ? null : value }));
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
          <p className="mb-4 text-sm text-primary">Saved successfully.</p>
        )}

        <form onSubmit={onSave} className="flex flex-col gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Row 1: Full Name (full width) */}
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

                {/* Row 2: Date of Birth | Blood Type */}
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

                {/* Row 3: Height | Weight */}
                <FormField label="Height" htmlFor="height">
                  <Input
                    id="height"
                    type="text"
                    disabled={!isAdmin}
                    value={fieldValue(form.height)}
                    onChange={(e) => set("height", e.target.value)}
                    placeholder={`e.g. 5'10"`}
                  />
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
                </FormField>

                {/* Row 4: Phone | Primary Language */}
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

                {/* Row 5: Allergies (full width) */}
                <div className="sm:col-span-2">
                  <FormField label="Allergies" htmlFor="allergies">
                    <Textarea
                      id="allergies"
                      disabled={!isAdmin}
                      value={fieldValue(form.allergies)}
                      onChange={(e) => set("allergies", e.target.value)}
                      placeholder="List known allergies..."
                    />
                  </FormField>
                </div>

                {/* Row 6: Emergency Contacts (full width) */}
                <div className="sm:col-span-2">
                  <FormField label="Emergency Contacts" htmlFor="emergency_contacts">
                    <Textarea
                      id="emergency_contacts"
                      disabled={!isAdmin}
                      value={fieldValue(form.emergency_contacts)}
                      onChange={(e) => set("emergency_contacts", e.target.value)}
                      placeholder="Name, relationship, phone number..."
                    />
                  </FormField>
                </div>

                {/* Row 7: Notes (full width) */}
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
