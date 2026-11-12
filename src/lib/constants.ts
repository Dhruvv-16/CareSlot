/**
 * constants.ts
 *
 * Application-wide constants for CareSlot.
 *
 * SECURITY: DEMO_PATIENT_ID is the server-injected identity for all
 * write operations. It must NEVER be accepted from client payloads or
 * passed as a parameter from the LLM.
 */

/** The fixed demo patient injected by server-side context into every tool call. */
export const DEMO_PATIENT_ID = "P001" as const;

/** Human-readable name for the demo patient (display only). */
export const DEMO_PATIENT_NAME = "Arjun Mehta" as const;

/** Clinic name displayed in the UI. */
export const CLINIC_NAME = "CareSlot Clinic" as const;

/** Consultation slot duration in minutes (implicit from SQL seed interval). */
export const SLOT_DURATION_MINUTES = 30 as const;

/** Currency symbol used for consultation fees. */
export const CURRENCY_SYMBOL = "₹" as const;

/** Clinic operating days (ISO day-of-week: 1=Mon … 6=Sat). Sunday=0 excluded. */
export const OPERATING_DAYS = [1, 2, 3, 4, 5, 6] as const;

/** First slot of the day. */
export const SLOT_START_TIME = "09:00" as const;

/** Last slot start time of the day. */
export const SLOT_END_TIME = "12:30" as const;

/**
 * Emergency response message shown when a patient describes urgent symptoms.
 * The LLM must prepend this verbatim before any other response.
 */
export const EMERGENCY_MESSAGE =
  "🚨 This sounds like a medical emergency. Please call 112 / 108 immediately or go to the nearest hospital Emergency Department right away. Do not wait for an outpatient appointment." as const;
