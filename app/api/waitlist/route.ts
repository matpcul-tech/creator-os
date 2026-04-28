import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // TODO: Connect to your database or webhook
    // For now, just log it
    console.log(`[Waitlist] New signup: ${email}`);

    return NextResponse.json({ success: true, message: "Added to waitlist" });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
