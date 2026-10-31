// Job rows plus the planner item the finished file is attached to.

import { prisma } from "@/lib/db";
import type { Aspect, JobStatus, JobView, ProduceInput } from "@/lib/produce/types";

export function newJobId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `prod_${Buffer.from(bytes).toString("hex")}`;
}

export async function createJob(id: string, contentId: number | null, input: ProduceInput) {
  return prisma.videoJob.create({
    data: {
      id,
      contentId,
      status: "queued",
      progress: 0,
      message: "Queued",
      aspect: input.aspect,
      title: input.title,
      input: JSON.stringify(input),
    },
  });
}

export async function readJob(id: string) {
  return prisma.videoJob.findUnique({ where: { id } });
}

export function viewJob(row: {
  id: string;
  status: string;
  progress: number;
  message: string;
  error: string;
  blocker: string;
  videoUrl: string;
  contentId: number | null;
  aspect: string;
  title: string;
}): JobView {
  return {
    jobId: row.id,
    status: row.status as JobStatus,
    progress: row.progress,
    message: row.message,
    error: row.error,
    blocker: row.blocker,
    videoUrl: row.videoUrl,
    contentId: row.contentId,
    aspect: (row.aspect === "16:9" ? "16:9" : "9:16") as Aspect,
    title: row.title,
  };
}

export async function patchJob(
  id: string,
  data: Partial<{
    status: JobStatus;
    progress: number;
    message: string;
    error: string;
    blocker: string;
    videoUrl: string;
    contentId: number | null;
  }>,
) {
  return prisma.videoJob.update({ where: { id }, data });
}

export async function ensureContent(opts: {
  contentId: number | null;
  title: string;
  aspect: Aspect;
  script: string;
  jobId: string;
}): Promise<number> {
  const platforms = opts.aspect === "9:16" ? ["tiktok", "instagram", "youtube"] : ["youtube"];
  if (opts.contentId) {
    const existing = await prisma.contentPiece.findUnique({ where: { id: opts.contentId } });
    if (!existing) throw new Error("That planner item was not found.");
    await prisma.contentPiece.update({
      where: { id: existing.id },
      data: {
        videoId: opts.jobId,
        videoStatus: "producing",
        videoUrl: "",
        ...(existing.scheduledAt ? {} : { scheduledAt: new Date() }),
      },
    });
    return existing.id;
  }
  const created = await prisma.contentPiece.create({
    data: {
      title: opts.title,
      status: "draft",
      platforms: JSON.stringify(platforms),
      body: opts.script,
      scheduledAt: new Date(),
      videoId: opts.jobId,
      videoStatus: "producing",
      videoUrl: "",
    },
  });
  return created.id;
}

export async function finishContent(contentId: number, jobId: string, videoUrl: string) {
  await prisma.contentPiece.update({
    where: { id: contentId },
    data: { videoId: jobId, videoStatus: "completed", videoUrl },
  });
}

export async function failContent(contentId: number | null, jobId: string) {
  if (!contentId) return;
  await prisma.contentPiece
    .update({
      where: { id: contentId },
      data: { videoId: jobId, videoStatus: "failed" },
    })
    .catch(() => undefined);
}

export async function channelName(): Promise<string> {
  const profile = await prisma.profile.findFirst().catch(() => null);
  const name = (profile?.name || "").trim();
  return name || "Creator OS";
}
