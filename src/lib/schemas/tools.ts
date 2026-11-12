/**
 * tools.ts — Zod input schemas for all 6 CareSlot tool functions.
 *
 * Rules:
 * - Every field that the LLM can supply is validated here.
 * - `patient_id` must NEVER appear in any schema: it is server-injected.
 * - `.trim()` preprocessing strips accidental whitespace from string fields.
 * - All schemas are exported individually for tree-shaking, and also
 *   collected in `ToolSchemas` for the Gemini function-declaration builder.
 */

import { z } from "zod";

// ─── Shared primitives ────────────────────────────────────────────────────────

/** Non-empty trimmed string — reused across schemas. */
const nonEmptyStr = z.string().trim().min(1, "Value cannot be empty");

/** YYYY-MM-DD date string validated via regex and Date parse. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid calendar date" });

// ─── 1. searchDoctors ─────────────────────────────────────────────────────────

/**
 * Input schema for `searchDoctors`.
 *
 * All fields are optional — an empty call returns all doctors.
 * At most one of `departmentId` / `keyword` will be used by the LLM at a time,
 * but the tool accepts any combination.
 *
 * IMPORTANT: `language` is matched case-insensitively against the
 * `doctors.languages` text[] column using PostgreSQL array containment.
 * The tool never claims a doctor speaks a language unless it is stored in the DB.
 */
export const SearchDoctorsSchema = z.object({
  /** Exact department ID, e.g. 'D02'. Use when the agent already knows the dept. */
  departmentId: z
    .string()
    .trim()
    .regex(/^D\d{2}$/, "departmentId must be like 'D01'")
    .optional(),

  /**
   * Language to filter by, e.g. 'Tamil', 'Hindi'.
   * Max 50 chars to block prompt-injection via long strings.
   */
  language: z.string().trim().min(1).max(50).optional(),

  /** Partial doctor name for fuzzy name search, e.g. 'Kavitha'. */
  doctorName: z.string().trim().min(1).max(100).optional(),

  /**
   * Free-text keyword matched against doctor name, department name,
   * and department common_issues. Used when the LLM has a symptom/specialty
   * but not a specific departmentId.
   */
  keyword: z.string().trim().min(1).max(200).optional(),
});

export type SearchDoctorsInput = z.infer<typeof SearchDoctorsSchema>;

// ─── 2. getAvailableSlots ────────────────────────────────────────────────────

export const GetAvailableSlotsSchema = z
  .object({
    /** Doctor whose availability to query. */
    doctorId: nonEmptyStr.regex(/^DR\d{2}$/, "doctorId must be like 'DR01'"),

    /** Single specific date. Mutually exclusive with startDate/endDate. */
    date: isoDate.optional(),

    /** Range start (inclusive). Must be used together with endDate. */
    startDate: isoDate.optional(),

    /** Range end (inclusive). Must be used together with startDate. */
    endDate: isoDate.optional(),
  })
  .refine(
    (d) => {
      // date and startDate/endDate are mutually exclusive
      if (d.date && (d.startDate || d.endDate)) return false;
      // startDate and endDate must come together
      if ((d.startDate && !d.endDate) || (!d.startDate && d.endDate))
        return false;
      // endDate must not precede startDate
      if (d.startDate && d.endDate && d.endDate < d.startDate) return false;
      return true;
    },
    {
      message:
        "Provide either `date` alone, or both `startDate`+`endDate` (endDate ≥ startDate).",
    }
  );

export type GetAvailableSlotsInput = z.infer<typeof GetAvailableSlotsSchema>;

// ─── 3. getMyAppointments ────────────────────────────────────────────────────

export const GetMyAppointmentsSchema = z.object({
  /** Filter by lifecycle status. Omit to return all statuses. */
  status: z.enum(["booked", "cancelled", "completed"]).optional(),
});

export type GetMyAppointmentsInput = z.infer<typeof GetMyAppointmentsSchema>;

// ─── 4. bookAppointment ──────────────────────────────────────────────────────

/**
 * patient_id is intentionally absent — injected server-side from DEMO_PATIENT_ID.
 */
export const BookAppointmentSchema = z.object({
  /** Doctor to book with. */
  doctorId: nonEmptyStr.regex(/^DR\d{2}$/, "doctorId must be like 'DR01'"),

  /** Slot ID obtained from getAvailableSlots. */
  slotId: z.number().int().positive("slotId must be a positive integer"),

  /**
   * Patient's self-stated reason for visit (administrative only).
   * Trimmed and capped to prevent excessively long strings.
   */
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export type BookAppointmentInput = z.infer<typeof BookAppointmentSchema>;

// ─── 5. rescheduleAppointment ────────────────────────────────────────────────

/**
 * patient_id is intentionally absent — the server verifies ownership
 * by checking appointment.patient_id = DEMO_PATIENT_ID.
 */
export const RescheduleAppointmentSchema = z.object({
  /** Appointment to move (must belong to P001 and have status 'booked'). */
  appointmentId: z
    .number()
    .int()
    .positive("appointmentId must be a positive integer"),

  /** New slot to move the appointment into. */
  newSlotId: z.number().int().positive("newSlotId must be a positive integer"),
});

export type RescheduleAppointmentInput = z.infer<
  typeof RescheduleAppointmentSchema
>;

// ─── 6. cancelAppointment ────────────────────────────────────────────────────

/**
 * patient_id is intentionally absent — the server verifies ownership
 * before cancelling.
 */
export const CancelAppointmentSchema = z.object({
  /** Appointment to cancel (must belong to P001 and have status 'booked'). */
  appointmentId: z
    .number()
    .int()
    .positive("appointmentId must be a positive integer"),
});

export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;

// ─── Collected export for Gemini function-declaration builder ─────────────────

export const ToolSchemas = {
  searchDoctors: SearchDoctorsSchema,
  getAvailableSlots: GetAvailableSlotsSchema,
  getMyAppointments: GetMyAppointmentsSchema,
  bookAppointment: BookAppointmentSchema,
  rescheduleAppointment: RescheduleAppointmentSchema,
  cancelAppointment: CancelAppointmentSchema,
} as const;

