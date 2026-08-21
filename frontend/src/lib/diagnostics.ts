/** AI diagnostic endpoints (RAD FR-06). Typed wrappers over `api.ts`. */
import { apiFetchData } from './api';
import type { VehicleType } from './mechanic';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type MessageRole = 'USER' | 'ASSISTANT';

export interface DiagnosticMessage {
  id: string;
  role: MessageRole;
  content: string;
  created_at?: string | null;
}

/** Advisory only — nothing in booking or matching reads this. */
export interface DiagnosticResult {
  severity: Severity | null;
  confidence: number | null;
  needs_mechanic: boolean | null;
  possible_causes: string[];
  follow_up_questions: string[];
}

export interface DiagnosticSession {
  id: string;
  vehicle_type: VehicleType;
  problem_description: string;
  status: 'ACTIVE' | 'COMPLETED';
  created_at?: string | null;
  result: DiagnosticResult;
  messages: DiagnosticMessage[];
}

export function startDiagnostic(
  vehicleType: VehicleType,
  problemDescription: string,
): Promise<DiagnosticSession> {
  return apiFetchData<DiagnosticSession>('/diagnostics/', {
    method: 'POST',
    body: { vehicle_type: vehicleType, problem_description: problemDescription },
  });
}

export function sendDiagnosticMessage(
  sessionId: string,
  content: string,
): Promise<DiagnosticSession> {
  return apiFetchData<DiagnosticSession>(`/diagnostics/${sessionId}/messages`, {
    method: 'POST',
    body: { content },
  });
}

export function getDiagnostic(sessionId: string): Promise<DiagnosticSession> {
  return apiFetchData<DiagnosticSession>(`/diagnostics/${sessionId}`);
}
