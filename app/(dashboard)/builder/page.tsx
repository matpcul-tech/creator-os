"use client";

import { useState } from "react";
import { FacelessBuilder } from "@/components/FacelessBuilder";

export default function BuilderPage() {
  const [title, setTitle] = useState("The 90-second rule");
  const [script, setScript] = useState("Your morning is busy. It is not productive.\nInbox before the hard thing is fake work.\nStart the ugly version for ninety seconds.\nThen tell me what broke.");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Faceless builder</h1>
        <p className="text-dark-400">Makes the headless video in the browser. Free. No avatar. Add the file from here.</p>
      </div>
      <div className="cai-card space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="cai-input" placeholder="Title" />
        <FacelessBuilder script={script} title={title} />
        <textarea value={script} onChange={(e) => setScript(e.target.value)} className="cai-input min-h-[80px]" />
      </div>
    </div>
  );
}
