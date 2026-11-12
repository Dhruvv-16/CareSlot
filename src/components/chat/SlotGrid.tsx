"use client";

import { Calendar, Clock } from "lucide-react";
import type { AvailableSlot } from "@/lib/tools";

interface SlotGridProps {
  slots: AvailableSlot[];
  onSelectSlot?: (slot: AvailableSlot) => void;
  selectedSlotId?: number | null;
}

export function SlotGrid({ slots, onSelectSlot, selectedSlotId }: SlotGridProps) {
  if (!slots || slots.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
        No open slots found for this selection.
      </div>
    );
  }

  // Group slots by date
  const grouped = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    acc[slot.slot_date] = acc[slot.slot_date] || [];
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  function formatDisplayDate(dateStr: string) {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  function formatTime(timeStr: string) {
    // "09:00:00" -> "09:00 AM"
    const [hh, mm] = timeStr.split(":");
    const h = parseInt(hh, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${ampm}`;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <Calendar className="h-3.5 w-3.5 text-teal-600" />
          <span>Available Slots ({slots.length} verified open)</span>
        </div>
        <span className="text-[11px] text-slate-500">
          {slots[0]?.doctor_name}
        </span>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {dates.map((dateStr) => {
          const daySlots = grouped[dateStr];
          return (
            <div key={dateStr} className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                {formatDisplayDate(dateStr)} ({dateStr})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {daySlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onSelectSlot?.(slot)}
                      className={`text-xs py-1.5 px-2 rounded-lg border font-medium transition-all text-center cursor-pointer ${
                        isSelected
                          ? "bg-teal-600 border-teal-600 text-white shadow-xs"
                          : "bg-teal-50/50 border-teal-200 text-teal-800 hover:bg-teal-100 hover:border-teal-300"
                      }`}
                    >
                      {formatTime(slot.start_time)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

