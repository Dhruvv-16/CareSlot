"use client";

import { Stethoscope, MapPin, Languages, Award } from "lucide-react";
import type { SearchDoctorResult } from "@/lib/tools";
import { CURRENCY_SYMBOL } from "@/lib/constants";

interface DoctorCardProps {
  doctor: SearchDoctorResult;
  onSelectDoctor?: (doctor: SearchDoctorResult) => void;
}

export function DoctorCard({ doctor, onSelectDoctor }: DoctorCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-teal-300 hover:shadow-sm transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h4 className="font-semibold text-slate-900 text-sm leading-tight">
              {doctor.name}
            </h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
              <Award className="h-3 w-3 text-slate-400" />
              <span>{doctor.qualification}</span>
              <span className="text-slate-300">•</span>
              <span>{doctor.experience_years} yrs exp</span>
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 whitespace-nowrap">
            {doctor.department_name}
          </span>
        </div>

        <div className="space-y-1.5 my-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>Room {doctor.room}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Languages className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1 flex-wrap">
              {doctor.languages.map((lang) => {
                const isTamil = lang.toLowerCase() === "tamil";
                return (
                  <span
                    key={lang}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isTamil
                        ? "bg-amber-50 text-amber-800 font-medium border border-amber-200"
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

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-1">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Fee</span>
          <span className="text-sm font-bold text-slate-900">
            {CURRENCY_SYMBOL}{doctor.consultation_fee}
          </span>
        </div>

        {onSelectDoctor && (
          <button
            type="button"
            onClick={() => onSelectDoctor(doctor)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors cursor-pointer flex items-center gap-1"
          >
            <Stethoscope className="h-3 w-3" />
            <span>Check Slots</span>
          </button>
        )}
      </div>
    </div>
  );
}

