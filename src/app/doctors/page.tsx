"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Users,
  MapPin,
  Calendar,
  Clock,
  Languages,
  Award,
  RefreshCw,
  X,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { SearchDoctorResult, AvailableSlot } from "@/lib/tools";
import { CURRENCY_SYMBOL } from "@/lib/constants";

const DEPARTMENTS = [
  { id: "", name: "All Specialties" },
  { id: "D01", name: "General Medicine" },
  { id: "D02", name: "Dermatology" },
  { id: "D03", name: "Pediatrics" },
  { id: "D04", name: "Orthopedics" },
  { id: "D05", name: "Cardiology" },
  { id: "D06", name: "ENT" },
  { id: "D07", name: "Ophthalmology" },
  { id: "D08", name: "Dental" },
];

const LANGUAGES = [
  "All",
  "Tamil",
  "English",
  "Hindi",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Urdu",
  "Marathi",
];

export default function DoctorsDirectoryPage() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<SearchDoctorResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Availability modal state
  const [selectedDoctor, setSelectedDoctor] = useState<SearchDoctorResult | null>(null);
  const [doctorSlots, setDoctorSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDept) params.set("departmentId", selectedDept);
      if (selectedLanguage && selectedLanguage !== "All") {
        params.set("language", selectedLanguage);
      }
      if (searchTerm.trim()) {
        params.set("keyword", searchTerm.trim());
      }

      const res = await fetch(`/api/doctors?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load doctors");
      }
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading doctors");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDept, selectedLanguage, searchTerm]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Fetch slots when a doctor is selected for inspection
  async function handleCheckAvailability(doc: SearchDoctorResult) {
    setSelectedDoctor(doc);
    setLoadingSlots(true);
    setSlotsError(null);
    setDoctorSlots([]);

    try {
      const res = await fetch(`/api/slots?doctorId=${doc.id}`);
      if (!res.ok) {
        throw new Error("Failed to load doctor slots");
      }
      const data = await res.json();
      setDoctorSlots(data.slots || []);
    } catch (err: unknown) {
      setSlotsError(err instanceof Error ? err.message : "Error loading availability");
    } finally {
      setLoadingSlots(false);
    }
  }

  function handleBookInChat(slot?: AvailableSlot) {
    if (!selectedDoctor) return;
    if (slot) {
      router.push(`/?prompt=${encodeURIComponent(`I would like to book slot #${slot.id} on ${slot.slot_date} at ${slot.start_time} with ${selectedDoctor.name}.`)}`);
    } else {
      router.push(`/?prompt=${encodeURIComponent(`Please check available slots for ${selectedDoctor.name} (${selectedDoctor.id}).`)}`);
    }
  }

  function clearAllFilters() {
    setSelectedDept("");
    setSelectedLanguage("All");
    setSearchTerm("");
  }

  const hasActiveFilters = selectedDept !== "" || selectedLanguage !== "All" || searchTerm !== "";

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Doctors Directory
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {doctors.length} Doctors Available
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse verified medical specialists at CareSlot Clinic. Filter by department or spoken languages.
          </p>
        </div>

        {/* Quick action back to chat */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer self-start md:self-center"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Book via Assistant</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by doctor name or specialty/symptom (e.g. 'Kavitha', 'skin rash', 'fever')..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Department Pills */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-teal-600" />
            <span>Specialty / Department</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DEPARTMENTS.map((dept) => {
              const isSelected = selectedDept === dept.id;
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setSelectedDept(dept.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {dept.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Filter Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Languages className="h-3 w-3 text-teal-600" />
              <span>Language:</span>
            </span>
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLanguage === lang;
              const isTamil = lang === "Tamil";
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                      : isTamil
                      ? "bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
            />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-800 space-y-2">
          <p className="font-bold text-sm">Failed to load clinic doctors</p>
          <p className="text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchDoctors}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              No doctors match your filters
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Try adjusting your specialty or language filters, or clear your search term.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map((doctor) => {
            const hasTamil = doctor.languages.some(
              (l) => l.toLowerCase() === "tamil"
            );

            return (
              <div
                key={doctor.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top: Doctor & Dept */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">
                        {doctor.id}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">
                        {doctor.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-slate-400" />
                        <span>{doctor.qualification}</span>
                        <span className="text-slate-300">•</span>
                        <span>{doctor.experience_years} yrs exp</span>
                      </p>
                    </div>

                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
                      {doctor.department_name}
                    </span>
                  </div>

                  {/* Middle: Details */}
                  <div className="my-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>Consultation Room: <strong className="font-semibold text-slate-800">{doctor.room}</strong></span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Languages className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                      <div className="flex items-center gap-1 flex-wrap">
                        {doctor.languages.map((lang) => {
                          const isTamil = lang.toLowerCase() === "tamil";
                          return (
                            <span
                              key={lang}
                              className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                isTamil
                                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {lang}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Fee & Check Availability */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Consultation Fee
                    </span>
                    <span className="text-base font-extrabold text-slate-900">
                      {CURRENCY_SYMBOL}{doctor.consultation_fee}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckAvailability(doctor)}
                    className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Check Availability</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Doctor Availability Inspector Modal */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800 uppercase tracking-wider">
                  {selectedDoctor.department_name}
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">
                  {selectedDoctor.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Room {selectedDoctor.room} • {CURRENCY_SYMBOL}{selectedDoctor.consultation_fee} fee • {selectedDoctor.languages.join(", ")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content: Live Slots */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-teal-600" />
                  <span>Real-Time Free Slots</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {doctorSlots.length} slots available
                </span>
              </div>

              {loadingSlots ? (
                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
                  <span>Checking database for open slots...</span>
                </div>
              ) : slotsError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  {slotsError}
                </div>
              ) : doctorSlots.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 p-4">
                  No upcoming free slots found for this doctor right now.
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
                  ).map(([date, slotsOnDay]) => (
                    <div key={date} className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600 block">
                        {date}
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {slotsOnDay.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => handleBookInChat(slot)}
                            className="text-xs font-medium py-1.5 px-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-colors cursor-pointer text-center"
                          >
                            {slot.start_time.slice(0, 5)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Click any slot time to book with assistant
              </span>
              <button
                type="button"
                onClick={() => handleBookInChat()}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Open in Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

