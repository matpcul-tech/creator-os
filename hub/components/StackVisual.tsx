const LINKS = {
  creatorOS: 'https://creator-os-5zc8.vercel.app',
  promptArchitect: 'https://prompt-architect-gules.vercel.app',
  manuscriptStudio: 'https://manuscript-studio-os.com',
}

export default function StackVisual() {
  return (
    <div className="stack-wrap">
      <div className="stack-box">
        <a className="stack-row" href={LINKS.creatorOS} target="_blank" rel="noopener noreferrer">
          <div className="s-icon ic-p">🎬</div>
          <span className="s-label">Creator OS</span>
          <span className="s-code">// video · content · brand</span>
        </a>
        <div className="s-divider"></div>
        <a className="stack-row" href={LINKS.promptArchitect} target="_blank" rel="noopener noreferrer">
          <div className="s-icon ic-t">⚡</div>
          <span className="s-label">Prompt Architect</span>
          <span className="s-code">// AI · frameworks · scoring</span>
        </a>
        <div className="s-divider"></div>
        <a className="stack-row" href={LINKS.manuscriptStudio} target="_blank" rel="noopener noreferrer">
          <div className="s-icon ic-g">📖</div>
          <span className="s-label">Manuscript Studio</span>
          <span className="s-code">// writing · validation · KDP</span>
        </a>
      </div>
    </div>
  )
}
