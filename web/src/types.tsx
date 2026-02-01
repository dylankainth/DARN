// src/types.ts
export interface Server {
  ip: string;
  ok: boolean;
  models: string;
  latency_ms: number;
  error?: string;
  checked_at: string;
  lat?: number;
  lon?: number;
}
