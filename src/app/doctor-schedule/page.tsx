"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  User,
  Phone,
  AlertTriangle,
  Stethoscope,
  MapPin,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Lock,
} from "lucide-react";

interface ScheduleSlotItem {
  slot_id: number;
  start_time: string;
  is_booked: boolean;
  appointment: {
    appointment_id: number;
    reason: string | null;
    status: string;
    patient: {
      id: string;
      name: string;
      age: number;
      phone: string;
    } | null;
  } | null;
}

interface DoctorScheduleData {
  doctor: {
    id: string;
    name: string;
    department_name: string;
    room: string;
    qualification: string;
  };
  date: string;
  schedule: ScheduleSlotItem[];
  metrics: {
    total_slots: number;
    booked_count: number;
    open_count: number;
  };
}

const DOCTORS = [
  { id: "DR01", name: "Dr. Kavitha Subramanian", dept: "General Medicine", room: "G-01" },
  { id: "DR02", name: "Dr. Rajesh Kumar", dept: "General Medicine", room: "G-02" },
  { id: "DR03", name: "Dr. Nisha Menon", dept: "Dermatology", room: "1-03" },
  { id: "DR04", name: "Dr. Farhan Ali", dept: "Dermatology", room: "1-04" },
  { id: "DR05", name: "Dr. Sowmya Rao", dept: "Pediatrics", room: "1-05" },
  { id: "DR06", name: "Dr. Prakash Iyer", dept: "Orthopedics", room: "2-01" },
  { id: "DR07", name: "Dr. Anjali Deshmukh", dept: "Orthopedics", room: "2-02" },
  { id: "DR08", name: "Dr. Venkatesh Reddy", dept: "Cardiology", room: "2-05" },
  { id: "DR09", name: "Dr. Meenakshi Sundaram", dept: "ENT", room: "1-07" },
  { id: "DR10", name: "Dr. Arvind Joshi", dept: "ENT", room: "1-08" },
  { id: "DR11", name: "Dr. Fathima Begum", dept: "Ophthalmology", room: "G-05" },
  { id: "DR12", name: "Dr. Sanjay Gupta", dept: "Ophthalmology", room: "G-06" },
  { id: "DR13", name: "Dr. Divya Krishnan", dept: "Dental", room: "G-08" },
  { id: "DR14", name: "Dr. Harish Babu", dept: "Dental", room: "G-09" },
  { id: "DR15", name: "Dr. Lalitha Ramesh", dept: "General Medicine", room: "G-03" },
];

export default function DoctorSchedulePage() {
  const [selectedDoctorId, setSelectedDoctorId] = useState("DR01");
  const [selectedDate, setSelectedDate] = useState("2026-11-13");
  const [data, setData] = useState<DoctorScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quickDates, setQuickDates] = useState<string[]>([]);

  // Initialize client local date safely in useEffect
  useEffect(() => {
    const now = new Date();
    const istMs = now.getTime() + 330 * 60 * 1000;
    const today = new Date(istMs).toISOString().slice(0, 10);
    setSelectedDate(today);

    const list: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * 86400000 + 330 * 60 * 1000);
      list.push(d.toISOString().slice(0, 10));
    }
    setQuickDates(list);
  }, []);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/doctor-schedule?doctorId=${selectedDoctorId}&date=${selectedDate}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load doctor schedule");
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading schedule");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDoctorId, selectedDate]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  function formatTime(timeStr: string) {
    if (!timeStr) return "";
    const [hh, mm] = timeStr.split(":");
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
  }



  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Prominent Demo Only Notice Banner */}
      <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase tracking-wider">
                Demo Only
              </span>
              <h2 className="font-bold text-sm text-slate-900">
                Clinician Schedule View Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Production deployment requires clinician SSO / RBAC authentication. In this demo, queries are strictly scoped to the selected doctor and date to prevent arbitrary data exposure.
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shrink-0"
        >
          Return to Patient Portal
        </Link>
      </div>

      {/* Header & Clinician Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Doctor Selector */}
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Select Clinician (Demo Identity)
          </label>
          <div className="relative max-w-md">
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              {DOCTORS.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.id} — {doc.name} ({doc.dept}, Room {doc.room})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Schedule Date
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white cursor-pointer"
            />
            <button
              type="button"
              onClick={fetchSchedule}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-teal-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Date Pills */}
      {quickDates.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Quick Dates:
          </span>
          {quickDates.map((dStr, idx) => {
            const isSelected = selectedDate === dStr;
            return (
              <button
                key={dStr}
                type="button"
                onClick={() => setSelectedDate(dStr)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : dStr.slice(5)}
              </button>
            );
          })}
        </div>
      )}

      {/* Doctor Info & Metrics Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Doctor Details
            </span>
            <h3 className="font-bold text-slate-900 text-sm mt-0.5 truncate">
              {data.doctor.name}
            </h3>
            <p className="text-xs text-slate-500">
              {data.doctor.department_name} • Room {data.doctor.room}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Daily Slots
            </span>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">
              {data.metrics.total_slots}
            </p>
            <p className="text-[11px] text-slate-500">
              09:00 to 12:30 (30-min intervals)
            </p>
          </div>

          <div className="bg-white border border-teal-200 bg-teal-50/20 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
              Booked Patients
            </span>
            <p className="text-xl font-extrabold text-teal-700 mt-0.5">
              {data.metrics.booked_count}
            </p>
            <p className="text-[11px] text-teal-600 font-medium">
              Confirmed consultations
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Open Slots
            </span>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
              {data.metrics.open_count}
            </p>
            <p className="text-[11px] text-slate-500">
              Available for patient booking
            </p>
          </div>
        </div>
      )}

      {/* Daily Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Daily Outpatient Timeline — {selectedDate}
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {data?.schedule.length || 0} Scheduled Intervals
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
            <span>Loading daily schedule from database...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 text-center">
            {error}
          </div>
        ) : data?.schedule.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl p-4">
            No schedule records found for this date. (Clinic is closed on Sundays).
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data?.schedule.map((item) => {
              const appt = item.appointment;
              const isBooked = item.is_booked;

              return (
                <div
                  key={item.slot_id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-3 transition-colors ${
                    isBooked
                      ? "bg-teal-50/40 hover:bg-teal-50/70"
                      : "hover:bg-slate-50/60"
                  }`}
                >
                  {/* Time column */}
                  <div className="flex items-center gap-3 sm:w-44 shrink-0">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      {formatTime(item.start_time)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isBooked
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {isBooked ? "Booked" : "Available"}
                    </span>
                  </div>

                  {/* Patient Info (Minimum Necessary Details) */}
                  <div className="flex-1">
                    {appt?.patient ? (
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            {appt.patient.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({appt.patient.age} yrs)
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {appt.patient.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {appt.patient.phone}
                          </span>
                          {appt.reason && (
                            <span className="italic truncate max-w-xs">
                              Reason: &ldquo;{appt.reason}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    ) : isBooked ? (
                      <span className="text-xs text-slate-500 italic">
                        Reserved slot (Patient details in process)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Open slot available for clinic booking
                      </span>
                    )}
                  </div>

                  {/* Right Slot ID */}
                  <div className="text-right text-[10px] font-mono text-slate-400">
                    Slot #{item.slot_id}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
