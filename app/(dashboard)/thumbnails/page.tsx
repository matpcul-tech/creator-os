"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { ThumbnailMaker } from "@/components/ThumbnailMaker";

function ThumbnailsInner() {
  const params = useSearchParams();
  const initialTitle = params.get("title") ?? "";
  const hook = params.get("hook") ?? "";
  const contentIdRaw = Number(params.get("contentId"));
  const contentId = Number.isInteger(contentIdRaw) && contentIdRaw > 0 ? contentIdRaw : null;
  const [title, setTitle] = useState(initialTitle);
  const [started, setStarted] = useState(Boolean(initialTitle));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Thumbnails</h1>
        <p className="text-dark-400">Make a YouTube or vertical thumbnail from a title, then download it or attach it to a piece.</p>
      </div>

      {!started ? (
        <div className="cai-card">
          <label htmlFor="thumb-title" className="text-sm font-medium text-dark-300 mb-1.5 block">Title or hook</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id="thumb-title" value={title} onChange={(e) => setTitle(e.target.value)} className="cai-input flex-1" placeholder="e.g. Three phone settings that save battery" />
            <button onClick={() => title.trim() && setStarted(true)} disabled={!title.trim()} className="px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-600 to-blue-600 text-white disabled:opacity-50">
              Start
            </button>
          </div>
        </div>
      ) : (
        <div className="cai-card">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon size={18} className="text-brand-400" />
            <h2 className="text-lg font-bold text-white truncate">{title}</h2>
          </div>
          <ThumbnailMaker title={title} hook={hook} contentId={contentId} />
        </div>
      )}
    </div>
  );
}

export default function ThumbnailsPage() {
  return (
    <Suspense fallback={<div className="text-dark-500 text-sm">Loading...</div>}>
      <ThumbnailsInner />
    </Suspense>
  );
}
