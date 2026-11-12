/**
 * book-appointment.ts — H6: `bookAppointment` tool implementation
 *
 * Atomic write: locks slot → verifies → marks booked → inserts appointment.
 * All steps execute inside a single PostgreSQL transaction via RPC.
 *
 * ── Security contract ────────────────────────────────────────────────────────
 * patient_id is NEVER accepted from the LLM or any client payload.
 * It is sourced exclusively from DEMO_PATIENT_ID in lib/constants.ts and
 * injected by this server-side function before the RPC call.
 *
 * ── Concurrency contract ─────────────────────────────────────────────────────
 * The PostgreSQL function `book_appointment` (src/lib/sql/book_appointment.sql)
 * uses SELECT...FOR UPDATE on the slot row. Two concurrent requests on the
 * same slotId will serialize: the second sees is_booked=true and returns
 * { ok: false, code: 'CONFLICT' }. Exactly one booking succeeds.
 *
 * ── RPC → TypeScript result mapping ──────────────────────────────────────────
 *   ok: true   → BookingSuccess  (appointment_id, full slot details)
 *   ok: false  → BookingFailure  (code + human-readable message)
 *
 * Success is reported ONLY after the RPC returns ok:true, which only
 * happens after the PostgreSQL transaction commits both the UPDATE and INSERT.
 */

import "server-only";

import { adminDb } from "@/lib/supabase-admin";
import { DEMO_PATIENT_ID } from "@/lib/constants";
import {
  BookAppointmentSchema,
  type BookAppointmentInput,
} from "@/lib/schemas/tools";

// ── Return types ──────────────────────────────────────────────────────────────

/** Returned when the booking transaction commits successfully. */
export interface BookingSuccess {
  appointment_id: number;
  slot_id: number;
  doctor_id: string;
  patient_id: string;   // always 'P001' — echoed from DB for confirmation
  slot_date: string;    // "YYYY-MM-DD"
  start_time: string;   // "HH:MM:SS"
  reason: string;
  status: "booked";
}

/** Returned when the booking is rejected before or during the transaction. */
export interface BookingFailure {
  code:
    | "VALIDATION_ERROR"  // Zod rejected the input
    | "NOT_FOUND"         // slotId does not exist in slots table
    | "DOCTOR_MISMATCH"   // slotId exists but belongs to a different doctor
    | "SLOT_PAST"         // slot date/time is in the past
    | "CONFLICT"          // slot was already booked (race condition)
    | "DB_ERROR"          // unexpected database error
    | "RPC_ERROR";        // Supabase RPC call itself failed (network/config)
  message: string;
}

export type BookAppointmentResult =
  | { success: true; data: BookingSuccess }
  | { success: false; error: BookingFailure };

// ── RPC response shape (matches book_appointment.sql RETURNS jsonb) ──────────

interface RpcOk {
  ok: true;
  appointment_id: number;
  slot_id: number;
  doctor_id: string;
  patient_id: string;
  slot_date: string;
  start_time: string;
  reason: string;
  status: "booked";
}

interface RpcFail {
  ok: false;
  code: "NOT_FOUND" | "DOCTOR_MISMATCH" | "SLOT_PAST" | "CONFLICT" | "DB_ERROR";
  message: string;
}

type RpcResponse = RpcOk | RpcFail;

// ── Implementation ────────────────────────────────────────────────────────────

export async function bookAppointment(
  rawInput: unknown
): Promise<BookAppointmentResult> {

  // ── 1. Validate inputs (Zod) ────────────────────────────────────────────────
  // patient_id is NOT in BookAppointmentSchema — it cannot be injected here.
  const parsed = BookAppointmentSchema.safeParse(rawInput);
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

  const { doctorId, slotId, reason } = parsed.data;

  // ── 2. Inject server-side patient identity ──────────────────────────────────
  // This is the ONLY place patient_id enters the system.
  // It comes from a compile-time constant, not from any external input.
  const patientId = DEMO_PATIENT_ID; // 'P001'

  // ── 3. Call the atomic PostgreSQL RPC ──────────────────────────────────────
  // The RPC runs the entire transaction:
  //   SELECT...FOR UPDATE → verify → UPDATE is_booked → INSERT appointment
  // We pass p_patient_id here — the SQL function signature accepts it,
  // but the value is always server-injected ('P001'), never LLM-sourced.
  const { data: rpcData, error: rpcError } = await adminDb.rpc(
    "book_appointment",
    {
      p_patient_id: patientId,
      p_doctor_id: doctorId,
      p_slot_id: slotId,
      p_reason: reason,
    }
  );

  // ── 4. Handle Supabase-level RPC failure (network, auth, missing function) ──
  if (rpcError) {
    return {
      success: false,
      error: {
        code: "RPC_ERROR",
        message:
          `Database call failed: ${rpcError.message}. ` +
          `Ensure book_appointment.sql has been run in Supabase SQL Editor.`,
      },
    };
  }

  // ── 5. Interpret the RPC's jsonb response ───────────────────────────────────
  const response = rpcData as unknown as RpcResponse;

  if (!response.ok) {
    // Transaction-level rejection (conflict, not found, past slot, etc.)
    return {
      success: false,
      error: {
        code: response.code,
        message: response.message,
      },
    };
  }

  // ── 6. Report success ONLY after committed transaction ─────────────────────
  // response.ok === true means both UPDATE and INSERT committed in PostgreSQL.
  return {
    success: true,
    data: {
      appointment_id: response.appointment_id,
      slot_id: response.slot_id,
      doctor_id: response.doctor_id,
      patient_id: response.patient_id,
      slot_date: response.slot_date,
      start_time: response.start_time,
      reason: response.reason,
      status: "booked",
    },
  };
}

