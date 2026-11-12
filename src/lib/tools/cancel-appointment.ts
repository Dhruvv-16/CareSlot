/**
 * cancel-appointment.ts — H7: `cancelAppointment` tool implementation
 *
 * Atomic cancellation: locks appointment & linked slot in PostgreSQL,
 * verifies P001 ownership and 'booked' status, marks appointment 'cancelled',
 * and frees the linked slot (is_booked = false).
 *
 * ── Security Contract ────────────────────────────────────────────────────────
 * patient_id is NEVER accepted from the LLM or any external payload.
 * It is sourced strictly from DEMO_PATIENT_ID in lib/constants.ts ('P001')
 * and passed server-side to the PostgreSQL function.
 * Any attempt to cancel an appointment belonging to another patient (P002-P005)
 * is rejected with code 'FORBIDDEN' without modifying data.
 *
 * ── State Integrity ──────────────────────────────────────────────────────────
 * - Unknown appointments return 'NOT_FOUND'.
 * - Appointments with status 'cancelled' return 'ALREADY_CANCELLED'.
 * - Appointments with status 'completed' return 'ALREADY_COMPLETED'.
 * - Linked slot is only freed when cancellation commits.
 */

import "server-only";

import { adminDb } from "@/lib/supabase-admin";
import { DEMO_PATIENT_ID } from "@/lib/constants";
import {
  CancelAppointmentSchema,
  type CancelAppointmentInput,
} from "@/lib/schemas/tools";

// ── Return Types ──────────────────────────────────────────────────────────────

export interface CancellationSuccess {
  appointment_id: number;
  patient_id: string; // 'P001'
  doctor_id: string;
  doctor_name: string;
  slot_id: number;
  slot_date: string;
  start_time: string;
  reason: string | null;
  previous_status: "booked";
  status: "cancelled";
  cancelled_at: string;
}

export interface CancellationFailure {
  code:
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "ALREADY_CANCELLED"
    | "ALREADY_COMPLETED"
    | "INVALID_STATUS"
    | "SLOT_NOT_FOUND"
    | "DB_ERROR"
    | "RPC_ERROR";
  message: string;
}

export type CancelAppointmentResult =
  | { success: true; data: CancellationSuccess }
  | { success: false; error: CancellationFailure };

// ── RPC Response Type ─────────────────────────────────────────────────────────

interface RpcOk {
  ok: true;
  appointment_id: number;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  slot_id: number;
  slot_date: string;
  start_time: string;
  reason: string | null;
  previous_status: "booked";
  status: "cancelled";
  cancelled_at: string;
}

interface RpcFail {
  ok: false;
  code:
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "ALREADY_CANCELLED"
    | "ALREADY_COMPLETED"
    | "INVALID_STATUS"
    | "SLOT_NOT_FOUND"
    | "DB_ERROR";
  message: string;
}

type RpcResponse = RpcOk | RpcFail;

// ── Implementation ────────────────────────────────────────────────────────────

export async function cancelAppointment(
  rawInput: unknown
): Promise<CancelAppointmentResult> {
  // ── 1. Validate inputs (Zod) ────────────────────────────────────────────────
  const parsed = CancelAppointmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
    };
  }

  const { appointmentId } = parsed.data;

  // ── 2. Inject server-side patient identity (P001) ───────────────────────────
  const patientId = DEMO_PATIENT_ID;

  // ── 3. Call atomic PostgreSQL RPC ──────────────────────────────────────────
  const { data: rpcData, error: rpcError } = await adminDb.rpc(
    "cancel_appointment",
    {
      p_patient_id: patientId,
      p_appointment_id: appointmentId,
    }
  );

  if (rpcError) {
    return {
      success: false,
      error: {
        code: "RPC_ERROR",
        message:
          `Database call failed: ${rpcError.message}. ` +
          `Ensure cancel_appointment.sql has been run in Supabase SQL Editor.`,
      },
    };
  }

  // ── 4. Process RPC result ───────────────────────────────────────────────────
  const response = rpcData as unknown as RpcResponse;

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: response.code,
        message: response.message,
      },
    };
  }

  return {
    success: true,
    data: {
      appointment_id: response.appointment_id,
      patient_id: response.patient_id,
      doctor_id: response.doctor_id,
      doctor_name: response.doctor_name,
      slot_id: response.slot_id,
      slot_date: response.slot_date,
      start_time: response.start_time,
      reason: response.reason,
      previous_status: response.previous_status,
      status: response.status,
      cancelled_at: response.cancelled_at,
    },
  };
}
