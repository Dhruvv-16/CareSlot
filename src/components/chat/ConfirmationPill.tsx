"use client";

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ConfirmationPillProps {
  promptText: string;
  onConfirm: () => void;
  onReject: () => void;
  isSubmitting?: boolean;
}

export function ConfirmationPill({
  promptText,
  onConfirm,
  onReject,
  isSubmitting = false,
}: ConfirmationPillProps) {
  return (
    <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-2.5 my-2">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed font-medium">
          {promptText}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60 justify-end">
        <button
          type="button"
          onClick={onReject}
          disabled={isSubmitting}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <XCircle className="h-3.5 w-3.5 text-slate-400" />
          <span>Cancel</span>
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{isSubmitting ? "Processing..." : "Yes, Confirm"}</span>
        </button>
      </div>
    </div>
  );
}

