import { createRecordClient } from "./records";

export interface VisionHistory {
  id: string;
  visit_date: string | null;
  provider_id: string | null;
  provider_other: string | null;
  rx_od: string | null;
  rx_os: string | null;
  notes: string | null;
}

export interface VisionHistoryInput {
  visit_date?: string | null;
  provider_id?: string | null;
  provider_other?: string | null;
  rx_od?: string | null;
  rx_os?: string | null;
  notes?: string | null;
}

export const visionHistoryApi = createRecordClient<VisionHistory, VisionHistoryInput, VisionHistoryInput>("/api/vision-history");
