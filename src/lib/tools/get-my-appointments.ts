/**
 * get-my-appointments.ts — Tool implementation for `getMyAppointments`
 *
 * Scoped strictly to DEMO_PATIENT_ID ('P001') via trusted server context.
 * Never allows querying another patient's appointments.
 *
 * Joins appointments with doctors, departments, and slots to provide
 * complete human-readable appointment records.
 */

import "server-only";

import { adminDb } from "@/lib/supabase-admin";
import { DEMO_PATIENT_ID } from "@/lib/constants";
import {
  GetMyAppointmentsSchema,
  type GetMyAppointmentsInput,
} from "@/lib/schemas/tools";
import type { AppointmentStatus } from "@/lib/database.types";

// ── Return Types ──────────────────────────────────────────────────────────────

export interface PatientAppointment {
  id: number;
  patient_id: string; // 'P001'
  doctor_id: string;
  doctor_name: string;
  department_id: string;
  department_name: string;
  qualification: string;
  room: string;
  consultation_fee: number;
  slot_id: number;
  slot_date: string;
  start_time: string;
  reason: string | null;
  status: AppointmentStatus;
  created_at: string;
}

export interface GetMyAppointmentsSuccess {
  appointments: PatientAppointment[];
  total: number;
}

export interface GetMyAppointmentsFailure {
  code: "VALIDATION_ERROR" | "DATABASE_ERROR";
  message: string;
}

export type GetMyAppointmentsResult =
  | { success: true; data: GetMyAppointmentsSuccess }
  | { success: false; error: GetMyAppointmentsFailure };

// ── Implementation ────────────────────────────────────────────────────────────

export async function getMyAppointments(
  rawInput: unknown = {}
): Promise<GetMyAppointmentsResult> {
  // ── 1. Validate inputs (Zod) ────────────────────────────────────────────────
  const parsed = GetMyAppointmentsSchema.safeParse(rawInput ?? {});
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

  const { status } = parsed.data;

  // ── 2. Query strictly scoped to DEMO_PATIENT_ID ─────────────────────────────
  let query = adminDb
    .from("appointments")
    .select(
      `
      id,
      patient_id,
      doctor_id,
      slot_id,
      reason,
      status,
      created_at,
      doctors!inner (
        name,
        department_id,
        qualification,
        room,
        consultation_fee,
        departments!inner (
          name
        )
      ),
      slots!inner (
        slot_date,
        start_time
      )
    `
    )
    .eq("patient_id", DEMO_PATIENT_ID);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: `Failed to fetch appointments: ${error.message}`,
      },
    };
  }

  // ── 3. Shape joined results into a clean flat structure ─────────────────────
  interface RawAppointmentJoin {
    id: number;
    patient_id: string;
    doctor_id: string;
    slot_id: number;
    reason: string | null;
    status: AppointmentStatus;
    created_at: string;
    doctors: {
      name: string;
      department_id: string;
      qualification: string;
      room: string;
      consultation_fee: number;
      departments: {
        name: string;
      };
    };
    slots: {
      slot_date: string;
      start_time: string;
    };
  }

  const rawRows = (data ?? []) as unknown as RawAppointmentJoin[];

  const formatted: PatientAppointment[] = rawRows.map((row) => ({
    id: row.id,
    patient_id: row.patient_id,
    doctor_id: row.doctor_id,
    doctor_name: row.doctors?.name ?? "",
    department_id: row.doctors?.department_id ?? "",
    department_name: row.doctors?.departments?.name ?? "",
    qualification: row.doctors?.qualification ?? "",
    room: row.doctors?.room ?? "",
    consultation_fee: row.doctors?.consultation_fee ?? 0,
    slot_id: row.slot_id,
    slot_date: row.slots?.slot_date ?? "",
    start_time: row.slots?.start_time ?? "",
    reason: row.reason,
    status: row.status,
    created_at: row.created_at,
  }));

  // Sort upcoming chronologically by slot_date, start_time
  formatted.sort((a, b) => {
    const cmp = a.slot_date.localeCompare(b.slot_date);
    if (cmp !== 0) return cmp;
    return a.start_time.localeCompare(b.start_time);
  });

  return {
    success: true,
    data: {
      appointments: formatted,
      total: formatted.length,
    },
  };
}

