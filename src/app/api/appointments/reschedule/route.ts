import { NextRequest, NextResponse } from "next/server";
import { rescheduleAppointment } from "@/lib/tools";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, newSlotId } = body;

    const result = await rescheduleAppointment({ appointmentId, newSlotId });
    if (!result.success) {
      const status =
        result.error.code === "FORBIDDEN"
          ? 403
          : result.error.code === "NOT_FOUND" ||
            result.error.code === "SLOT_NOT_FOUND"
          ? 404
          : result.error.code === "CONFLICT"
          ? 409
          : 400;

      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status }
      );
    }

    return NextResponse.json(result.data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

