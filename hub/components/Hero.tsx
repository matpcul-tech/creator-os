import StackVisual from './StackVisual'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid"></div>
      <div className="hero-radial"></div>
      <div className="hero-inner">
        <div className="badge">
          <span className="badge-dot"></span> Sovereign Shield Technologies
        </div>
        <h1>
          One platform.<br />
          <span className="ac">Three creator tools.</span><br />
          Infinite output.
        </h1>
        <p className="hero-sub">
          Creator OS, Prompt Architect, and Manuscript Studio — unified into a single sovereign AI
          stack. Built for founders, authors, and entrepreneurs who ship without a team.
        </p>
        <div className="hero-btns">
          <a href="#pricing" className="btn-main">Start Building Free</a>
          <a href="#partner" className="btn-outline">Partner Inquiry</a>
        </div>
      </div>
      <StackVisual />
    </section>
  )
}
