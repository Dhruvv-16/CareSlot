"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Users,
  CalendarCheck,
  CalendarDays,
  UserCheck,
  Building2,
} from "lucide-react";
import { DEMO_PATIENT_NAME, DEMO_PATIENT_ID } from "@/lib/constants";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Booking Chat", icon: MessageSquare },
    { href: "/doctors", label: "Doctors", icon: Users },
    { href: "/appointments", label: "My Appointments", icon: CalendarCheck },
    { href: "/doctor-schedule", label: "Doctor's View", icon: CalendarDays, badge: "Demo" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 tracking-tight block leading-none">
                  CareSlot
                </span>
                <span className="text-xs text-slate-500 font-medium tracking-wide">
                  Outpatient Clinic Assistant
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-1 text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Demo Identity Badge */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-xs font-semibold text-slate-900">
                  {DEMO_PATIENT_NAME}
                </span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                  {DEMO_PATIENT_ID}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">29 yrs • Chennai</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-teal-700 shadow-xs">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-100 py-2 bg-slate-50/50 px-2">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md text-xs font-medium ${
                isActive ? "text-teal-600 font-semibold" : "text-slate-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}

