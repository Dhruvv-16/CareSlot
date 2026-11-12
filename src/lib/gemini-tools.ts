/**
 * gemini-tools.ts — Function declarations & server-side dispatch for CareSlot (H10)
 *
 * Exposes exactly 6 tools to Gemini:
 * 1. searchDoctors
 * 2. getAvailableSlots
 * 3. getMyAppointments
 * 4. bookAppointment
 * 5. rescheduleAppointment
 * 6. cancelAppointment
 *
 * Rules:
 * - Parameter definitions match Zod schemas.
 * - patient_id is NEVER in any parameter schema (server-injected P001).
 * - All executions run server-side only.
 * - Confirmation safeguard ensures write tools are never called prematurely.
 */

import { Type, type FunctionDeclaration } from "@google/genai";
import {
  searchDoctors,
  getAvailableSlots,
  getMyAppointments,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
} from "@/lib/tools";

// ── Function Declarations for Gemini ──────────────────────────────────────────

export const searchDoctorsDeclaration: FunctionDeclaration = {
  name: "searchDoctors",
  description:
    "Search the clinic directory for doctors. Supports filtering by department ID, language (e.g. 'Tamil', 'Hindi'), partial doctor name, or keyword (symptoms like 'skin rash', 'fever', 'joint pain').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      departmentId: {
        type: Type.STRING,
        description: "Exact clinic department ID, e.g. 'D01' (General Medicine), 'D02' (Dermatology), 'D03' (Pediatrics), 'D04' (Orthopedics), 'D05' (Cardiology), 'D06' (ENT), 'D07' (Ophthalmology), 'D08' (Dental).",
      },
      language: {
        type: Type.STRING,
        description: "Language spoken by doctor (e.g. 'Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam'). Checked against doctors.languages array.",
      },
      doctorName: {
        type: Type.STRING,
        description: "Partial doctor name for lookup, e.g. 'Kavitha'.",
      },
      keyword: {
        type: Type.STRING,
        description: "Symptom or specialty keyword matched against doctor name, department name, and common issues (e.g. 'skin rash', 'chest pain', 'knee pain').",
      },
    },
  },
};

export const getAvailableSlotsDeclaration: FunctionDeclaration = {
  name: "getAvailableSlots",
  description:
    "Query real-time available future slots for a doctor. Returns only slots where is_booked=false, ordered chronologically. Returns empty if no free slots exist. Never invent slots.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      doctorId: {
        type: Type.STRING,
        description: "Doctor ID whose slots to check, e.g. 'DR01', 'DR02', 'DR03'.",
      },
      date: {
        type: Type.STRING,
        description: "Single specific date in YYYY-MM-DD format (e.g. '2026-11-13').",
      },
      startDate: {
        type: Type.STRING,
        description: "Start of date range in YYYY-MM-DD format. Must be used with endDate.",
      },
      endDate: {
        type: Type.STRING,
        description: "End of date range in YYYY-MM-DD format. Must be used with startDate.",
      },
    },
    required: ["doctorId"],
  },
};

export const getMyAppointmentsDeclaration: FunctionDeclaration = {
  name: "getMyAppointments",
  description:
    "List existing appointments for the logged-in patient (Arjun Mehta, P001). Returns doctor, department, date, time, room, and status.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        description: "Optional lifecycle filter: 'booked', 'cancelled', or 'completed'.",
      },
    },
  },
};

export const bookAppointmentDeclaration: FunctionDeclaration = {
  name: "bookAppointment",
  description:
    "Atomically book an available slot for Arjun Mehta (P001). Locks slot and creates booking record. ONLY call after summarizing details and receiving explicit confirmation from the patient.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      doctorId: {
        type: Type.STRING,
        description: "Doctor ID to book with, e.g. 'DR01'.",
      },
      slotId: {
        type: Type.INTEGER,
        description: "Unique integer ID of the slot to reserve (from getAvailableSlots).",
      },
      reason: {
        type: Type.STRING,
        description: "Administrative reason for consultation (e.g. 'Consultation for skin rash').",
      },
    },
    required: ["doctorId", "slotId", "reason"],
  },
};

export const rescheduleAppointmentDeclaration: FunctionDeclaration = {
  name: "rescheduleAppointment",
  description:
    "Atomically move an existing booked appointment to a new open slot. Frees old slot and locks new slot. ONLY call after summarizing new slot details and receiving explicit confirmation from the patient.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointmentId: {
        type: Type.INTEGER,
        description: "ID of Arjun Mehta's existing booked appointment to reschedule.",
      },
      newSlotId: {
        type: Type.INTEGER,
        description: "ID of the new open slot to move into (from getAvailableSlots).",
      },
    },
    required: ["appointmentId", "newSlotId"],
  },
};

export const cancelAppointmentDeclaration: FunctionDeclaration = {
  name: "cancelAppointment",
  description:
    "Atomically cancel an existing booked appointment for Arjun Mehta (P001) and release its reserved slot. ONLY call after summarizing appointment details and receiving explicit confirmation from the patient.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      appointmentId: {
        type: Type.INTEGER,
        description: "ID of Arjun Mehta's booked appointment to cancel.",
      },
    },
    required: ["appointmentId"],
  },
};

export const CARESLOT_TOOLS = [
  {
    functionDeclarations: [
      searchDoctorsDeclaration,
      getAvailableSlotsDeclaration,
      getMyAppointmentsDeclaration,
      bookAppointmentDeclaration,
      rescheduleAppointmentDeclaration,
      cancelAppointmentDeclaration,
    ],
  },
];

// ── Server-Side Tool Dispatcher ───────────────────────────────────────────────

export interface ToolExecutionRecord {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

/**
 * Checks whether the user's latest message indicates explicit confirmation.
 */
export function hasExplicitConfirmation(userText: string): boolean {
  const normalized = userText.toLowerCase().trim();
  const affirmativePatterns = [
    /^(yes|y|yeah|yup|yep|sure|ok|okay|confirm|confirmed|proceed|go ahead|book it|book this|reschedule|cancel)$/i,
    /\b(yes please|please book|please confirm|go ahead and book|go ahead and cancel|confirm booking|confirm reschedule)\b/i,
    /\b(yes,?\s+(please|book|confirm|proceed|go ahead))\b/i,
    /\b(book the appointment|book slot|reschedule my appointment|cancel my appointment)\b/i,
  ];

  return affirmativePatterns.some((p) => p.test(normalized));
}

/**
 * Executes a tool call server-side with strict Zod validation and security guards.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  latestUserMessage: string
): Promise<{ result: unknown; isError: boolean }> {
  try {
    switch (name) {
      case "searchDoctors": {
        const res = await searchDoctors(args);
        return { result: res, isError: !res.success };
      }

      case "getAvailableSlots": {
        const res = await getAvailableSlots(args);
        return { result: res, isError: !res.success };
      }

      case "getMyAppointments": {
        const res = await getMyAppointments(args);
        return { result: res, isError: !res.success };
      }

      case "bookAppointment": {
        // Confirmation safeguard: Verify user affirmed this action
        if (!hasExplicitConfirmation(latestUserMessage)) {
          return {
            result: {
              success: false,
              error: {
                code: "CONFIRMATION_REQUIRED",
                message:
                  "Write actions require two-stage confirmation. Please summarize the doctor name, department, date, time, room, fee, and reason, and ask Arjun Mehta for explicit confirmation before booking.",
              },
            },
            isError: true,
          };
        }
        const res = await bookAppointment(args);
        return { result: res, isError: !res.success };
      }

      case "rescheduleAppointment": {
        if (!hasExplicitConfirmation(latestUserMessage)) {
          return {
            result: {
              success: false,
              error: {
                code: "CONFIRMATION_REQUIRED",
                message:
                  "Rescheduling requires two-stage confirmation. Please summarize the new doctor, date, time, and room, and ask Arjun Mehta for explicit confirmation before moving the appointment.",
              },
            },
            isError: true,
          };
        }
        const res = await rescheduleAppointment(args);
        return { result: res, isError: !res.success };
      }

      case "cancelAppointment": {
        if (!hasExplicitConfirmation(latestUserMessage)) {
          return {
            result: {
              success: false,
              error: {
                code: "CONFIRMATION_REQUIRED",
                message:
                  "Cancellation requires explicit confirmation. Please ask Arjun Mehta to confirm cancelling this appointment before releasing the slot.",
              },
            },
            isError: true,
          };
        }
        const res = await cancelAppointment(args);
        return { result: res, isError: !res.success };
      }

      default:
        return {
          result: {
            success: false,
            error: {
              code: "UNKNOWN_TOOL",
              message: `Tool '${name}' is not recognized.`,
            },
          },
          isError: true,
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal tool execution error";
    return {
      result: {
        success: false,
        error: {
          code: "TOOL_ERROR",
          message,
        },
      },
      isError: true,
    };
  }
}

