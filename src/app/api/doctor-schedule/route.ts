import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase-admin";

const DoctorScheduleQuerySchema = z.object({
  doctorId: z.string().trim().regex(/^DR\d{2}$/, "doctorId must be like 'DR01'"),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = DoctorScheduleQuerySchema.safeParse({
      doctorId: searchParams.get("doctorId") || "",
      date: searchParams.get("date") || "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { doctorId, date } = parsed.data;

    // 1. Fetch Doctor Info
    const { data: doctor, error: docError } = await adminDb
      .from("doctors")
      .select("id, name, department_id, qualification, consultation_fee, room, departments(name)")
      .eq("id", doctorId)
      .maybeSingle();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    if (!doctor) {
      return NextResponse.json({ error: `Doctor ${doctorId} not found` }, { status: 404 });
    }

    // 2. Fetch all slots for this doctor on the selected date
    const { data: slots, error: slotsError } = await adminDb
      .from("slots")
      .select("id, doctor_id, slot_date, start_time, is_booked")
      .eq("doctor_id", doctorId)
      .eq("slot_date", date)
      .order("start_time", { ascending: true });

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 });
    }

    const slotList = slots || [];
    const slotIds = slotList.map((s) => s.id);

    // 3. Fetch appointments strictly for these slots
    let appointmentsMap: Record<number, {
      appointment_id: number;
      reason: string | null;
      status: string;
      patient: {
        id: string;
        name: string;
        age: number;
        phone: string;
      } | null;
    }> = {};

    if (slotIds.length > 0) {
      const { data: appts, error: apptsError } = await adminDb
        .from("appointments")
        .select(`
          id,
          slot_id,
          reason,
          status,
          patients (
            id,
            name,
            age,
            phone
          )
        `)
        .eq("doctor_id", doctorId)
        .in("slot_id", slotIds);

      if (apptsError) {
        return NextResponse.json({ error: apptsError.message }, { status: 500 });
      }

      interface RawJoinedAppt {
        id: number;
        slot_id: number;
        reason: string | null;
        status: string;
        patients: {
          id: string;
          name: string;
          age: number;
          phone: string;
        } | null;
      }

      const rows = (appts || []) as unknown as RawJoinedAppt[];
      for (const row of rows) {
        appointmentsMap[row.slot_id] = {
          appointment_id: row.id,
          reason: row.reason,
          status: row.status,
          patient: row.patients,
        };
      }
    }

    // 4. Combine slots with appointment info
    const schedule = slotList.map((slot) => {
      const appt = appointmentsMap[slot.id] || null;
      return {
        slot_id: slot.id,
        start_time: slot.start_time,
        is_booked: slot.is_booked,
        appointment: appt,
      };
    });

    return NextResponse.json({
      doctor: {
        id: doctor.id,
        name: doctor.name,
        department_name: (doctor.departments as unknown as { name: string })?.name || "",
        room: doctor.room,
        qualification: doctor.qualification,
      },
      date,
      schedule,
      metrics: {
        total_slots: schedule.length,
        booked_count: schedule.filter((s) => s.is_booked).length,
        open_count: schedule.filter((s) => !s.is_booked).length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

