import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/tools";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const date = searchParams.get("date") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    if (!doctorId) {
      return NextResponse.json(
        { error: "doctorId parameter is required" },
        { status: 400 }
      );
    }

    const result = await getAvailableSlots({
      doctorId,
      date,
      startDate,
      endDate,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.error, code: result.error.code },
        { status: result.error.code === "NOT_FOUND" ? 404 : 400 }
      );
    }

    return NextResponse.json({ slots: result.data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

