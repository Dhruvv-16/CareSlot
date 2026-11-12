/**
 * tools/index.ts — Barrel export for all 6 CareSlot tool functions.
 *
 * Import from here rather than directly from individual tool files.
 * All exports are server-only (each tool file imports "server-only").
 */

export { searchDoctors } from "./search-doctors";
export type {
  SearchDoctorResult,
  SearchDoctorsResult,
  ToolError,
} from "./search-doctors";

export { getAvailableSlots } from "./get-available-slots";
export type { AvailableSlot, GetAvailableSlotsResult } from "./get-available-slots";

export { bookAppointment } from "./book-appointment";
export type {
  BookingSuccess,
  BookingFailure,
  BookAppointmentResult,
} from "./book-appointment";

export { cancelAppointment } from "./cancel-appointment";
export type {
  CancellationSuccess,
  CancellationFailure,
  CancelAppointmentResult,
} from "./cancel-appointment";

export { rescheduleAppointment } from "./reschedule-appointment";
export type {
  RescheduleSuccess,
  RescheduleFailure,
  RescheduleAppointmentResult,
} from "./reschedule-appointment";

export { getMyAppointments } from "./get-my-appointments";
export type {
  PatientAppointment,
  GetMyAppointmentsSuccess,
  GetMyAppointmentsFailure,
  GetMyAppointmentsResult,
} from "./get-my-appointments";

