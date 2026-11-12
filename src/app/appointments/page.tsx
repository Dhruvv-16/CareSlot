"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  CalendarCheck,
  RotateCcw,
  AlertCircle,
  XCircle,
  CheckCircle2,
  CalendarDays,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import type { PatientAppointment, AvailableSlot } from "@/lib/tools";
import {
  DEMO_PATIENT_NAME,
  DEMO_PATIENT_ID,
  CURRENCY_SYMBOL,
} from "@/lib/constants";

type StatusFilter = "all" | "booked" | "cancelled" | "completed";

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Cancellation modal state
  const [cancelModalAppt, setCancelModalAppt] = useState<PatientAppointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Reschedule modal state
  const [rescheduleAppt, setRescheduleAppt] = useState<PatientAppointment | null>(null);
  const [doctorSlots, setDoctorSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedNewSlot, setSelectedNewSlot] = useState<AvailableSlot | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Success toast/banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments");
      if (!res.ok) {
        throw new Error("Failed to load appointments");
      }
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading appointments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function formatDisplayDate(dateStr: string) {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  function formatTime(timeStr: string) {
    if (!timeStr) return "";
    const [hh, mm] = timeStr.split(":");
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
  }

  // Open cancellation modal
  function handleInitiateCancel(appt: PatientAppointment) {
    setCancelError(null);
    setCancelModalAppt(appt);
  }

  // Commit atomic cancellation
  async function handleConfirmCancel() {
    if (!cancelModalAppt) return;
    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch("/api/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: cancelModalAppt.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel appointment");
      }

      setCancelModalAppt(null);
      setSuccessBanner(
        `Appointment #${data.appointment_id} with ${data.doctor_name} has been cancelled and the slot freed.`
      );
      fetchAppointments();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("careslot:appointment-updated"));
      }
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setIsCancelling(false);
    }
  }

  // Open reschedule modal
  async function handleInitiateReschedule(appt: PatientAppointment) {
    setRescheduleError(null);
    setSelectedNewSlot(null);
    setRescheduleAppt(appt);
    setLoadingSlots(true);
    setDoctorSlots([]);

    try {
      const res = await fetch(`/api/slots?doctorId=${appt.doctor_id}`);
      if (!res.ok) {
        throw new Error("Failed to load doctor availability");
      }
      const data = await res.json();
      // Filter out the currently booked slot
      const filtered = (data.slots || []).filter(
        (s: AvailableSlot) => s.id !== appt.slot_id
      );
      setDoctorSlots(filtered);
    } catch (err: unknown) {
      setRescheduleError(
        err instanceof Error ? err.message : "Failed to load slots for rescheduling"
      );
    } finally {
      setLoadingSlots(false);
    }
  }

  // Commit atomic reschedule
  async function handleConfirmReschedule() {
    if (!rescheduleAppt || !selectedNewSlot) return;
    setIsRescheduling(true);
    setRescheduleError(null);

    try {
      const res = await fetch("/api/appointments/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: rescheduleAppt.id,
          newSlotId: selectedNewSlot.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reschedule appointment");
      }

      setRescheduleAppt(null);
      setSelectedNewSlot(null);
      setSuccessBanner(
        `Appointment #${data.appointment_id} moved to ${data.slot_date} at ${data.start_time.slice(0, 5)} with ${data.doctor_name}.`
      );
      fetchAppointments();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("careslot:appointment-updated"));
      }
    } catch (err: unknown) {
      setRescheduleError(
        err instanceof Error ? err.message : "Rescheduling failed"
      );
    } finally {
      setIsRescheduling(false);
    }
  }

  // Filter appointments
  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter === "all") return true;
    return appt.status === statusFilter;
  });

  const bookedCount = appointments.filter((a) => a.status === "booked").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              My Appointments
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
              {DEMO_PATIENT_ID}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
            <span>
              Verified records for <strong>{DEMO_PATIENT_NAME}</strong> (29 yrs, Chennai). Strictly scoped to your patient account.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={fetchAppointments}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
            title="Refresh from database"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-teal-600" : ""}`} />
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Book New in Chat</span>
          </Link>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successBanner}</div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === "all"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All ({appointments.length})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("booked")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            statusFilter === "booked"
              ? "bg-teal-600 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Upcoming / Booked ({bookedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("completed")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === "completed"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Completed ({completedCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("cancelled")}
          className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
            statusFilter === "cancelled"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Cancelled ({cancelledCount})
        </button>
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-slate-100 border border-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-800 space-y-2">
          <AlertCircle className="h-6 w-6 text-red-600 mx-auto" />
          <p className="font-bold text-sm">Failed to load appointments</p>
          <p className="text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchAppointments}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 mt-2"
          >
            Try Again
          </button>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              No appointments found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {statusFilter === "all"
                ? "You have no clinic consultations recorded yet."
                : `No appointments with status '${statusFilter}'.`}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Book with CareSlot Assistant</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((appt) => {
            const isBooked = appt.status === "booked";
            const isCancelled = appt.status === "cancelled";

            return (
              <div
                key={appt.id}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isBooked
                    ? "border-teal-200/80 hover:border-teal-300"
                    : "border-slate-200 opacity-90"
                }`}
              >
                {/* Left info block */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      #{appt.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isBooked
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : isCancelled
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {appt.status}
                    </span>
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                      {appt.department_name}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900 leading-tight">
                      {appt.doctor_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {appt.qualification} • Room {appt.room}
                    </p>
                  </div>

                  {appt.reason && (
                    <p className="text-xs text-slate-600 italic">
                      Reason: &ldquo;{appt.reason}&rdquo;
                    </p>
                  )}
                </div>

                {/* Right time & actions block */}
                <div className="flex flex-col md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right space-y-1">
                    <div className="flex items-center md:justify-end gap-1.5 text-xs sm:text-sm font-bold text-slate-900">
                      <Calendar className="h-4 w-4 text-teal-600" />
                      <span>{formatDisplayDate(appt.slot_date)}</span>
                    </div>
                    <div className="flex items-center md:justify-end gap-1.5 text-xs font-semibold text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatTime(appt.start_time)}</span>
                      <span className="text-slate-300">•</span>
                      <span>{CURRENCY_SYMBOL}{appt.consultation_fee}</span>
                    </div>
                  </div>

                  {/* Actions (Only available for active booked appointments) */}
                  {isBooked && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleInitiateReschedule(appt)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="h-3 w-3 text-slate-500" />
                        <span>Reschedule</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateCancel(appt)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <XCircle className="h-3 w-3 text-rose-500" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Cancel Appointment #{cancelModalAppt.id}?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This action will atomically release the slot back into the clinic&apos;s available pool.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-700">
              <p>
                <strong>Doctor:</strong> {cancelModalAppt.doctor_name} ({cancelModalAppt.department_name})
              </p>
              <p>
                <strong>Date & Time:</strong> {cancelModalAppt.slot_date} at {formatTime(cancelModalAppt.start_time)}
              </p>
              <p>
                <strong>Room:</strong> {cancelModalAppt.room}
              </p>
            </div>

            {cancelError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {cancelError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                disabled={isCancelling}
                className="text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel Booking</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                  Reschedule Booking
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">
                  Move Appointment #{rescheduleAppt.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Currently with {rescheduleAppt.doctor_name} on {rescheduleAppt.slot_date} at {formatTime(rescheduleAppt.start_time)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRescheduleAppt(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Content: Free Slots */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-teal-600" />
                <span>Select a New Open Slot for {rescheduleAppt.doctor_name}</span>
              </div>

              {loadingSlots ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
                  <span>Loading open slots from database...</span>
                </div>
              ) : rescheduleError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {rescheduleError}
                </div>
              ) : doctorSlots.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl p-4">
                  No alternative free slots available for this doctor right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Group slots by date */}
                  {Object.entries(
                    doctorSlots.reduce<Record<string, AvailableSlot[]>>((acc, s) => {
                      acc[s.slot_date] = acc[s.slot_date] || [];
                      acc[s.slot_date].push(s);
                      return acc;
                    }, {})
                  ).map(([dateStr, slotsOnDate]) => (
                    <div key={dateStr} className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600 block">
                        {formatDisplayDate(dateStr)} ({dateStr})
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {slotsOnDate.map((slot) => {
                          const isSelected = selectedNewSlot?.id === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedNewSlot(slot)}
                              className={`text-xs py-1.5 px-2 rounded-lg border font-medium transition-all text-center cursor-pointer ${
                                isSelected
                                  ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                                  : "bg-teal-50/60 border-teal-200 text-teal-800 hover:bg-teal-100"
                              }`}
                            >
                              {formatTime(slot.start_time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with confirmation */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {selectedNewSlot ? (
                  <span>
                    New slot: <strong className="text-slate-900">{selectedNewSlot.slot_date} at {formatTime(selectedNewSlot.start_time)}</strong>
                  </span>
                ) : (
                  <span className="text-slate-400">Select a time slot above</span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setRescheduleAppt(null)}
                  disabled={isRescheduling}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  disabled={!selectedNewSlot || isRescheduling}
                  className="text-xs font-semibold px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                >
                  {isRescheduling ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Swapping slots...</span>
                    </>
                  ) : (
                    <span>Confirm Reschedule</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

