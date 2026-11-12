"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { PatientAppointment } from "@/lib/tools";
import { DEMO_PATIENT_NAME, CURRENCY_SYMBOL } from "@/lib/constants";

interface AppointmentMiniListProps {
  onSelectAction?: (action: "reschedule" | "cancel", appt: PatientAppointment) => void;
  refreshKey?: number;
}

export function AppointmentMiniList({
  onSelectAction,
  refreshKey = 0,
}: AppointmentMiniListProps) {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [fetchAppointments, refreshKey]);

  // Listen for global custom refresh event
  useEffect(() => {
    function handleGlobalRefresh() {
      fetchAppointments();
    }
    window.addEventListener("careslot:appointment-updated", handleGlobalRefresh);
    return () => {
      window.removeEventListener("careslot:appointment-updated", handleGlobalRefresh);
    };
  }, [fetchAppointments]);

  function formatTime(timeStr: string) {
    if (!timeStr) return "";
    const [hh, mm] = timeStr.split(":");
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
  }

  const bookedAppointments = appointments.filter((a) => a.status === "booked");
  const pastOrCancelled = appointments.filter((a) => a.status !== "booked");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-sm text-slate-900">
            {DEMO_PATIENT_NAME}&apos;s Visits
          </h3>
          <p className="text-[11px] text-slate-500">
            Live database records (P001)
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAppointments}
          disabled={isLoading}
          title="Refresh appointments"
          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-teal-600" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-3 pr-1">
        {isLoading && appointments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
            <span>Loading appointments...</span>
          </div>
        ) : error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : bookedAppointments.length === 0 && pastOrCancelled.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No clinic appointments yet.
          </div>
        ) : (
          <>
            {bookedAppointments.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  Upcoming ({bookedAppointments.length})
                </span>
                {bookedAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-3 rounded-xl border border-teal-200 bg-teal-50/30 space-y-2 transition-all"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {appt.doctor_name}
                        </p>
                        <p className="text-[11px] text-teal-700 font-medium">
                          {appt.department_name}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Booked
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{appt.slot_date}</span>
                        <span className="text-slate-300">•</span>
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{formatTime(appt.start_time)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>Room {appt.room}</span>
                        <span className="text-slate-300">•</span>
                        <span>{CURRENCY_SYMBOL}{appt.consultation_fee}</span>
                      </div>
                      {appt.reason && (
                        <p className="text-[10px] text-slate-500 italic truncate pt-0.5">
                          &ldquo;{appt.reason}&rdquo;
                        </p>
                      )}
                    </div>

                    {onSelectAction && (
                      <div className="pt-2 border-t border-teal-100 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectAction("reschedule", appt)}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectAction("cancel", appt)}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {pastOrCancelled.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Past / Cancelled
                </span>
                {pastOrCancelled.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs text-slate-500 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 text-[11px]">
                        {appt.doctor_name}
                      </span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                          appt.status === "cancelled"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span>{appt.slot_date}</span>
                      <span>•</span>
                      <span>{formatTime(appt.start_time)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

