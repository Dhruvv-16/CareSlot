/**
 * reschedule-appointment.ts — H8: `rescheduleAppointment` tool implementation
 *
 * Atomic reschedule:
 * 1. Verifies appointment belongs to P001 and is 'booked'.
 * 2. Locks both old and new slots in consistent ascending order (deadlock prevention).
 * 3. Validates new slot is in the future and is_booked = false.
 * 4. Frees old slot, reserves new slot, and updates appointment slot_id/doctor_id
 *    in a single atomic database transaction.
 * 5. Returns updated doctor, date, start time, and room details.
 *
 * ── Security Contract ────────────────────────────────────────────────────────
 * patient_id is NEVER accepted from the LLM or any external payload.
 * It is sourced strictly from DEMO_PATIENT_ID in lib/constants.ts ('P001')
 * and passed server-side to the PostgreSQL RPC function.
 * Reschedule attempts on another patient's appointment fail with 'FORBIDDEN'.
 */

import "server-only";

import { adminDb } from "@/lib/supabase-admin";
import { DEMO_PATIENT_ID } from "@/lib/constants";
import {
  RescheduleAppointmentSchema,
  type RescheduleAppointmentInput,
} from "@/lib/schemas/tools";

// ── Return Types ──────────────────────────────────────────────────────────────

export interface RescheduleSuccess {
  appointment_id: number;
  patient_id: string; // 'P001'
  doctor_id: string;
  doctor_name: string;
  qualification: string;
  room: string;
  old_slot_id: number;
  new_slot_id: number;
  slot_date: string;
  start_time: string;
  reason: string | null;
  status: "booked";
}

export interface RescheduleFailure {
  code:
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_STATUS"
    | "SAME_SLOT"
    | "SLOT_NOT_FOUND"
    | "CONFLICT"
    | "SLOT_PAST"
    | "DOCTOR_NOT_FOUND"
    | "DB_ERROR"
    | "RPC_ERROR";
  message: string;
}

export type RescheduleAppointmentResult =
  | { success: true; data: RescheduleSuccess }
  | { success: false; error: RescheduleFailure };

// ── RPC Response Type ─────────────────────────────────────────────────────────

interface RpcOk {
  ok: true;
  appointment_id: number;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  qualification: string;
  room: string;
  old_slot_id: number;
  new_slot_id: number;
  slot_date: string;
  start_time: string;
  reason: string | null;
  status: "booked";
}

interface RpcFail {
  ok: false;
  code:
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "INVALID_STATUS"
    | "SAME_SLOT"
    | "SLOT_NOT_FOUND"
    | "CONFLICT"
    | "SLOT_PAST"
    | "DOCTOR_NOT_FOUND"
    | "DB_ERROR";
  message: string;
}

type RpcResponse = RpcOk | RpcFail;

// ── Implementation ────────────────────────────────────────────────────────────

export async function rescheduleAppointment(
  rawInput: unknown
): Promise<RescheduleAppointmentResult> {
  // ── 1. Validate inputs (Zod) ────────────────────────────────────────────────
  const parsed = RescheduleAppointmentSchema.safeParse(rawInput);
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

  const { appointmentId, newSlotId } = parsed.data;

  // ── 2. Inject server-side patient identity (P001) ───────────────────────────
  const patientId = DEMO_PATIENT_ID;

  // ── 3. Call atomic PostgreSQL RPC ──────────────────────────────────────────
  const { data: rpcData, error: rpcError } = await adminDb.rpc(
    "reschedule_appointment",
    {
      p_patient_id: patientId,
      p_appointment_id: appointmentId,
      p_new_slot_id: newSlotId,
    }
  );

  if (rpcError) {
    return {
      success: false,
      error: {
        code: "RPC_ERROR",
        message:
          `Database call failed: ${rpcError.message}. ` +
          `Ensure reschedule_appointment.sql has been run in Supabase SQL Editor.`,
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
      qualification: response.qualification,
      room: response.room,
      old_slot_id: response.old_slot_id,
      new_slot_id: response.new_slot_id,
      slot_date: response.slot_date,
      start_time: response.start_time,
      reason: response.reason,
      status: "booked",
    },
  };
}

