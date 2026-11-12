import { NextRequest, NextResponse } from "next/server";
import { cancelAppointment } from "@/lib/tools";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId } = body;

    const result = await cancelAppointment({ appointmentId });
    if (!result.success) {
      const status =
        result.error.code === "FORBIDDEN"
          ? 403
          : result.error.code === "NOT_FOUND"
          ? 404
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

