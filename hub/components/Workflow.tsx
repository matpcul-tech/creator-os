export default function Workflow() {
  return (
    <section id="workflow">
      <div className="container">
        <p className="sec-label">Workflow</p>
        <h2 className="sec-title">The stack in motion — idea to published in four steps.</h2>
        <p className="sec-sub">
          Each tool is complete independently. Together they form a full pipeline from concept to
          creation to launch.
        </p>
        <div className="flow-row">
          <div className="flow-cell">
            <span className="fc-step">STEP 01</span>
            <div className="fc-title">Architect the prompt</div>
            <p className="fc-desc">
              Open Prompt Architect. Design a high-performance prompt for your content, chapter, or
              campaign. Score it before you commit.
            </p>
          </div>
          <div className="flow-cell">
            <span className="fc-step">STEP 02</span>
            <div className="fc-title">Draft the content</div>
            <p className="fc-desc">
              Send the prompt to Manuscript Studio for long-form writing, or to Creator OS for video
              scripts and social content.
            </p>
          </div>
          <div className="flow-cell">
            <span className="fc-step">STEP 03</span>
            <div className="fc-title">Validate and refine</div>
            <p className="fc-desc">
              Run Sovereign Prose Validation or preview your video with captions and motion. Fix
              issues in one click.
            </p>
          </div>
          <div className="flow-cell">
            <span className="fc-step">STEP 04</span>
            <div className="fc-title">Publish and promote</div>
            <p className="fc-desc">
              Launch your book on KDP or push video content across platforms — without leaving the
              stack or switching tabs.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
