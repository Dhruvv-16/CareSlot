import { NextRequest, NextResponse } from "next/server";
import { searchDoctors } from "@/lib/tools";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const language = searchParams.get("language") || undefined;
    const doctorName = searchParams.get("doctorName") || undefined;
    const keyword = searchParams.get("keyword") || undefined;

    const result = await searchDoctors({
      departmentId,
      language,
      doctorName,
      keyword,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ doctors: result.data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

