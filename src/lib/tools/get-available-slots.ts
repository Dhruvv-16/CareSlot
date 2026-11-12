/**
 * get-available-slots.ts — H5: `getAvailableSlots` tool implementation
 *
 * Returns only REAL future open slots from the database — no fabrication.
 *
 * Key invariants:
 *  - `is_booked = false` is filtered in PostgreSQL, not in JS. If the DB
 *    says a slot is taken, it is taken; we never re-interpret that flag.
 *  - "Future" means: slot_date > today, OR (slot_date = today AND
 *    start_time > current local time). Today's past slots are excluded.
 *  - Doctor existence is validated before the slot query; a bad doctor ID
 *    returns NOT_FOUND, not an empty list.
 *  - An empty result is a valid, honest answer — the caller must present it
 *    as "no free slots" and never invent alternatives.
 *  - Results are ordered slot_date ASC, start_time ASC (chronological).
 *
 * "Future" time handling:
 *   slots.start_time is stored as PostgreSQL `time` (no timezone).
 *   The clinic operates in IST (UTC+5:30). To avoid importing a TZ library
 *   we use the following strategy:
 *     1. Filter slot_date >= today (server date in IST) in Supabase.
 *     2. For any rows returned with slot_date === today, discard those
 *        whose start_time string "HH:MM:SS" ≤ currentLocalTimeString.
 *   This keeps all logic transparent and avoids off-by-one edge cases.
 */

import "server-only";

import { adminDb } from "@/lib/supabase-admin";
import {
  GetAvailableSlotsSchema,
  type GetAvailableSlotsInput,
} from "@/lib/schemas/tools";

// ── Return type ───────────────────────────────────────────────────────────────

/** One available slot row returned to the LLM and UI. */
export interface AvailableSlot {
  id: number;          // slots.id  — used as slotId in bookAppointment
  doctor_id: string;   // FK to doctors — echoed back for LLM context
  doctor_name: string; // joined from doctors.name
  slot_date: string;   // "YYYY-MM-DD"
  start_time: string;  // "HH:MM:SS"  (30-minute slots; end = start + 30min)
}

export interface ToolError {
  error: string;
  code: "VALIDATION_ERROR" | "DATABASE_ERROR" | "NOT_FOUND";
}

export type GetAvailableSlotsResult =
  | { success: true; data: AvailableSlot[] }
  | { success: false; error: ToolError };

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns today's date as "YYYY-MM-DD" in IST (UTC+5:30).
 * Uses a fixed offset rather than a locale string so the output is
 * always padded correctly regardless of the runtime's locale setting.
 */
function todayIST(): string {
  const now = new Date();
  // Offset IST = UTC + 5h30m = 330 minutes
  const istMs = now.getTime() + 330 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Returns current IST time as "HH:MM:SS" for comparison with slot start_time.
 * We add 30 seconds of buffer so a slot starting "right now" is not shown.
 */
function currentTimeIST(): string {
  const now = new Date();
  const istMs = now.getTime() + 330 * 60 * 1000 + 30 * 1000; // +30s buffer
  const d = new Date(istMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// ── Implementation ────────────────────────────────────────────────────────────

export async function getAvailableSlots(
  rawInput: unknown
): Promise<GetAvailableSlotsResult> {

  // ── 1. Validate inputs ──────────────────────────────────────────────────────
  const parsed = GetAvailableSlotsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
    };
  }

  const { doctorId, date, startDate, endDate } = parsed.data;

  // ── 2. Validate doctor exists ───────────────────────────────────────────────
  // This is a separate query so we can distinguish "doctor not found" from
  // "doctor exists but has no free slots". The LLM must know the difference.
  const { data: doctorRow, error: doctorError } = await adminDb
    .from("doctors")
    .select("id, name")
    .eq("id", doctorId)
    .maybeSingle(); // returns null (not error) if no row found

  if (doctorError) {
    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        error: `Doctor lookup failed: ${doctorError.message}`,
      },
    };
  }

  if (!doctorRow) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        error: `Doctor '${doctorId}' does not exist in the database.`,
      },
    };
  }

  // ── 3. Build date bounds for the slot query ─────────────────────────────────
  const today = todayIST();

  // The effective lower bound is always today (past slots are never shown).
  const lowerBound: string = (() => {
    if (date)      return date;      // single-day: lower = that day (if ≥ today)
    if (startDate) return startDate < today ? today : startDate;
    return today;                    // no date filter: all future slots
  })();

  const upperBound: string | null = (() => {
    if (date)    return date;    // single-day: lower === upper
    if (endDate) return endDate;
    return null;                 // no upper bound — return all future slots
  })();

  // Guard: if the requested date/range is entirely in the past, return empty.
  if (upperBound && upperBound < today) {
    return { success: true, data: [] };
  }

  // ── 4. Query slots ──────────────────────────────────────────────────────────
  // is_booked = false is enforced in PostgreSQL — this is the authoritative
  // source of truth. We never relax or reinterpret this flag in TypeScript.
  let slotQuery = adminDb
    .from("slots")
    .select("id, doctor_id, slot_date, start_time")
    .eq("doctor_id", doctorId)
    .eq("is_booked", false)
    .gte("slot_date", lowerBound)       // slot_date ≥ lower bound
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (upperBound) {
    slotQuery = slotQuery.lte("slot_date", upperBound); // slot_date ≤ upper bound
  }

  const { data: slotsData, error: slotsError } = await slotQuery;

  if (slotsError) {
    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        error: `Slot query failed: ${slotsError.message}`,
      },
    };
  }

  if (!slotsData || slotsData.length === 0) {
    // Honest empty result — do not fabricate.
    return { success: true, data: [] };
  }

  // ── 5. Strip today's already-passed time slots ──────────────────────────────
  // Slots with slot_date = today and start_time ≤ current IST time are stale.
  // The DB can't filter this without a timezone-aware function, so we do it
  // in JS on the small result set returned.
  const nowIST = currentTimeIST();
  interface RawSlot { id: number; doctor_id: string; slot_date: string; start_time: string }
  const rawSlots = slotsData as unknown as RawSlot[];

  const futureSlots = rawSlots.filter((slot) => {
    if (slot.slot_date > today) return true;         // future day — always keep
    if (slot.slot_date < today) return false;        // past day — always drop
    // Same day: keep only if start_time is in the future
    return slot.start_time > nowIST;
  });

  // ── 6. Shape output ─────────────────────────────────────────────────────────
  // doctor_name is joined from the already-fetched doctorRow — no extra query.
  const result: AvailableSlot[] = futureSlots.map((slot) => ({
    id: slot.id,
    doctor_id: slot.doctor_id,
    doctor_name: (doctorRow as unknown as { id: string; name: string }).name,
    slot_date: slot.slot_date,
    start_time: slot.start_time,
  }));

  return { success: true, data: result };
}

