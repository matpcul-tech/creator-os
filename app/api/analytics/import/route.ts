import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// CSV importer for analytics.
// Accepts CSV pasted from YouTube Studio, X analytics, or any tool that
// exports columns including views/likes/comments/shares/followers.
//
// Heuristic header detection — case-insensitive, handles common synonyms.

const HEADER_MAP: Record<string, string> = {
  views: "views",
  impressions: "views",
  "video views": "views",
  reach: "views",
  likes: "likes",
  "like count": "likes",
  hearts: "likes",
  comments: "comments",
  replies: "comments",
  "comment count": "comments",
  shares: "shares",
  reposts: "shares",
  retweets: "shares",
  saves: "saves",
  bookmarks: "saves",
  followers: "followers",
  subscribers: "followers",
  "follower count": "followers",
  "subscriber count": "followers",
};

const NUMERIC_FIELDS = ["views", "likes", "comments", "shares", "saves", "followers"] as const;

function parseCSV(text: string): string[][] {
  // Tiny CSV parser that handles quoted fields with embedded commas.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseNumber(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[,$\s%]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function POST(req: Request) {
  const body = await req.json();
  const csv: string = body.csv ?? "";
  const platform: string = body.platform ?? "youtube";

  if (!csv || csv.length < 10) {
    return NextResponse.json({ error: "CSV body is empty." }, { status: 400 });
  }

  const rows = parseCSV(csv).filter((r) => r.length > 0 && r.some((c) => c.trim()));
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSV needs a header row plus at least one data row." },
      { status: 400 },
    );
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const columnMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const target = HEADER_MAP[h];
    if (target && columnMap[target] === undefined) columnMap[target] = i;
  });

  if (Object.keys(columnMap).length === 0) {
    return NextResponse.json(
      {
        error:
          "No recognizable columns. Expected at least one of: views, likes, comments, shares, saves, followers.",
        headers,
      },
      { status: 400 },
    );
  }

  const created = [];
  for (const row of rows.slice(1)) {
    const data: Record<string, number> = {};
    for (const field of NUMERIC_FIELDS) {
      const idx = columnMap[field];
      data[field] = idx !== undefined ? parseNumber(row[idx] ?? "") : 0;
    }
    const hasAnyValue = Object.values(data).some((v) => v > 0);
    if (!hasAnyValue) continue;

    const snap = await prisma.analyticsSnapshot.create({
      data: {
        platform,
        capturedAt: new Date(),
        ...data,
      },
    });
    created.push(snap.id);
  }

  return NextResponse.json({
    imported: created.length,
    skipped: rows.length - 1 - created.length,
    matchedColumns: Object.keys(columnMap),
  });
}
