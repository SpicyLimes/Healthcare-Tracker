import { createRecordClient } from "./records";

export interface VisitLog {
  id: string;
  visit_date: string | null;
  visit_time: string | null;
  doctor_id: string | null;
  doctor_other: string | null;
  reason: string | null;
  summary: string | null;
  follow_up: string | null;
  follow_up_date: string | null;
  notes: string | null;
}

export interface VisitLogInput {
  visit_date?: string | null;
  visit_time?: string | null;
  doctor_id?: string | null;
  doctor_other?: string | null;
  reason?: string | null;
  summary?: string | null;
  follow_up?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
}

export const visitLogsApi = createRecordClient<VisitLog, VisitLogInput, VisitLogInput>("/api/visit-logs");
