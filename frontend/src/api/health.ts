export interface HealthStatus {
  status: string;
  database: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return (await response.json()) as HealthStatus;
}
