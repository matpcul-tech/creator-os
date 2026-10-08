"use client";

import { useState } from "react";
import { FacelessBuilder } from "@/components/FacelessBuilder";
import { titleFromScript } from "@/lib/cut/builder-cards";

const DEFAULT_SCRIPT =
  "Your morning is busy. It is not productive.\nInbox before the hard thing is fake work.\nStart the ugly version for ninety seconds.\nThen tell me what broke.";
const DEFAULT_TITLE = "The 90-second rule";

export default function BuilderPage() {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [titleEdited, setTitleEdited] = useState(false);
  const [script, setScript] = useState(DEFAULT_SCRIPT);

  function onScriptChange(value: string) {
    setScript(value);
    // Until the title is typed by hand, it follows the first sentence of the script.
    if (!titleEdited) setTitle(value.trim() ? titleFromScript(value) : DEFAULT_TITLE);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Faceless builder</h1>
        <p className="text-dark-400">Makes the headless video in the browser. Free. No avatar. Add the file from here.</p>
      </div>
      <div className="cai-card space-y-3">
        <div>
          <label htmlFor="builder-title" className="text-xs font-medium text-dark-300 mb-1.5 block">
            Title. Names the video file. It follows the first sentence until you type your own.
          </label>
          <input
            id="builder-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleEdited(e.target.value.trim().length > 0);
            }}
            className="cai-input"
            placeholder="Title"
          />
        </div>
        <FacelessBuilder script={script} title={title} onScriptChange={onScriptChange} />
      </div>
    </div>
  );
}
