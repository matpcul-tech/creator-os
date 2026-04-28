import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Placeholder auth route — wire up your auth provider here
  return NextResponse.json({ message: "Auth endpoint ready. Connect NextAuth, Clerk, or Supabase Auth." });
}
