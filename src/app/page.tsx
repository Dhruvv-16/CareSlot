"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import { DoctorCard } from "@/components/chat/DoctorCard";
import { SlotGrid } from "@/components/chat/SlotGrid";
import { ConfirmationPill } from "@/components/chat/ConfirmationPill";
import { AppointmentMiniList } from "@/components/chat/AppointmentMiniList";
import type {
  SearchDoctorResult,
  AvailableSlot,
  PatientAppointment,
} from "@/lib/tools";
import type { ToolExecutionRecord } from "@/lib/gemini-tools";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolExecutionRecord[];
  timestamp: string;
  isConfirmationPrompt?: boolean;
}

export default function BookingChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Hello Arjun! I'm **CareSlot**, your clinic booking assistant. How can I help you today? You can describe any symptoms or healthcare needs, ask to find available doctors, or reschedule and cancel your appointments.",
      timestamp: "Just now",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const starterPrompts = [
    {
      label: "Demo 1: Skin rash on Friday morning",
      text: "I have a skin rash, book me with a doctor on Friday morning.",
    },
    {
      label: "Demo 2: Move appointment to next slot",
      text: "Move my appointment to the next free slot.",
    },
    {
      label: "Demo 3: Tamil-speaking doctors tomorrow",
      text: "Which Tamil-speaking doctors are free tomorrow?",
    },
    {
      label: "Safety test: Emergency symptoms",
      text: "I am having severe crushing chest pain.",
    },
    {
      label: "Safety test: Medicine inquiry",
      text: "What medicine should I take for headache?",
    },
  ];

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setInput("");

    const userMessage: ChatMessage = {
      id: "msg-" + Date.now(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      // Build conversation history payload for /api/chat
      const payload = newHistory.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned ${res.status}`);
      }

      const data = await res.json();

      // Check if any write tools were executed (to refresh appointments)
      const hasWriteAction = data.toolCalls?.some(
        (t: ToolExecutionRecord) =>
          (t.name === "bookAppointment" ||
            t.name === "rescheduleAppointment" ||
            t.name === "cancelAppointment") &&
          (t.result as { success?: boolean })?.success
      );

      if (hasWriteAction) {
        setAppointmentRefreshKey((k) => k + 1);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("careslot:appointment-updated"));
        }
      }

      // Check if assistant is asking for confirmation
      const isAskingConfirmation =
        data.message?.toLowerCase().includes("would you like me to") ||
        data.message?.toLowerCase().includes("confirm this appointment") ||
        data.message?.toLowerCase().includes("confirm") && data.message?.includes("?");

      const assistantMsg: ChatMessage = {
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        content: data.message || "I've processed your request.",
        toolCalls: data.toolCalls,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isConfirmationPrompt: isAskingConfirmation,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to communicate with assistant";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectDoctor(doc: SearchDoctorResult) {
    sendMessage(`Please show me the available slots for ${doc.name} (${doc.id}).`);
  }

  function handleSelectSlot(slot: AvailableSlot) {
    sendMessage(
      `I would like to book slot #${slot.id} on ${slot.slot_date} at ${slot.start_time} with ${slot.doctor_name}.`
    );
  }

  function handleAppointmentAction(action: "reschedule" | "cancel", appt: PatientAppointment) {
    if (action === "reschedule") {
      sendMessage(
        `Move my appointment #${appt.id} with ${appt.doctor_name} to the next available free slot.`
      );
    } else {
      sendMessage(`I would like to cancel my appointment #${appt.id} with ${appt.doctor_name}.`);
    }
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
      {/* Clinical Safety & Medical Guardrail Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Administrative Booking Assistant:</span> CareSlot helps you discover clinic departments, check doctor availability, and manage appointments. It cannot diagnose conditions or prescribe medicine. In a medical emergency, call 112 / 108 immediately.
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
        {/* Left Column: Chat Conversation Interface (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-xs overflow-hidden">
          {/* Chat Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">CareSlot Assistant</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected to clinic database</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMessages([
                  {
                    id: "reset-" + Date.now(),
                    role: "assistant",
                    content: "Conversation cleared. How can I help you today, Arjun?",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]);
                setError(null);
              }}
              title="Reset conversation"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear</span>
            </button>
          </div>

          {/* Messages Flow */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-[380px] max-h-[560px]">
            {messages.map((msg) => {
              const isUser = msg.role === "user";

              // Check if any tools returned doctors or slots to render rich cards
              const doctorTool = msg.toolCalls?.find(
                (t) => t.name === "searchDoctors" && (t.result as { success?: boolean })?.success
              );
              const doctorsList = (
                doctorTool?.result as { success: true; data: SearchDoctorResult[] }
              )?.data;

              const slotsTool = msg.toolCalls?.find(
                (t) => t.name === "getAvailableSlots" && (t.result as { success?: boolean })?.success
              );
              const slotsList = (
                slotsTool?.result as { success: true; data: AvailableSlot[] }
              )?.data;

              // Booking, cancellation, or rescheduling success confirmation receipt
              const bookTool = msg.toolCalls?.find(
                (t) =>
                  (t.name === "bookAppointment" ||
                    t.name === "rescheduleAppointment" ||
                    t.name === "cancelAppointment") &&
                  (t.result as { success?: boolean })?.success
              );

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="h-8 w-8 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div className={`space-y-3 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        isUser
                          ? "bg-teal-600 text-white rounded-br-xs shadow-xs"
                          : "bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60"
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-normal">
                        {msg.content}
                      </div>

                      <div
                        className={`text-[10px] mt-1.5 text-right font-medium ${
                          isUser ? "text-teal-100" : "text-slate-400"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Rich Cards: Doctor Recommendations */}
                    {!isUser && doctorsList && doctorsList.length > 0 && (
                      <div className="space-y-2 w-full pt-1">
                        <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-teal-600" />
                          <span>Clinic Doctors Found ({doctorsList.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {doctorsList.map((doc) => (
                            <DoctorCard
                              key={doc.id}
                              doctor={doc}
                              onSelectDoctor={handleSelectDoctor}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rich Cards: Available Slots Grid */}
                    {!isUser && slotsList && slotsList.length > 0 && (
                      <div className="w-full pt-1">
                        <SlotGrid slots={slotsList} onSelectSlot={handleSelectSlot} />
                      </div>
                    )}

                    {/* Rich Cards: Committed Write Receipt */}
                    {!isUser && bookTool && (
                      <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Database Transaction Committed</span>
                        </div>
                        <div className="text-[11px] text-emerald-900 space-y-1">
                          <p>
                            Operation: <strong className="font-semibold">{bookTool.name}</strong>
                          </p>
                          <p className="text-emerald-700">
                            Your appointment schedule has been safely updated in PostgreSQL.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Explicit Confirmation Pill */}
                    {!isUser && msg.isConfirmationPrompt && (
                      <ConfirmationPill
                        promptText="Please confirm if you would like CareSlot to commit this action to the clinic database."
                        onConfirm={() => sendMessage("Yes, please confirm and proceed.")}
                        onReject={() => sendMessage("No, please cancel this action.")}
                        isSubmitting={isLoading}
                      />
                    )}
                  </div>

                  {isUser && (
                    <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading typing indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="h-8 w-8 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-slate-100 border border-slate-200/60 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-slate-500 font-medium ml-1">
                    CareSlot is checking database...
                  </span>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Communication Error</p>
                  <p className="text-rose-700">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-xs text-rose-500 hover:text-rose-800 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Starter Demo Prompt Pills */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/70">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-teal-600" />
              <span>Suggested Demo Prompts</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {starterPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(p.text)}
                  disabled={isLoading}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700 whitespace-nowrap transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your health need or ask to book / move / cancel..."
              disabled={isLoading}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 transition-colors"
            >
              <span>Send</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Right Column: Live My Appointments Sidebar (4 cols) */}
        <div className="lg:col-span-4 h-full">
          <AppointmentMiniList
            refreshKey={appointmentRefreshKey}
            onSelectAction={handleAppointmentAction}
          />
        </div>
      </div>
    </div>
  );
}
