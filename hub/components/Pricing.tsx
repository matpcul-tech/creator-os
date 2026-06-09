'use client'
import { useState } from 'react'

export default function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing">
      <div className="container">
        <p className="sec-label">Pricing</p>
        <h2 className="sec-title">Start free. Scale when you ship.</h2>
        <p className="sec-sub">
          One subscription covers the full stack. Upgrade when your output demands it — or stay free
          until it does.
        </p>

        <div className="price-toggle">
          <span className={`toggle-label${!annual ? ' active' : ''}`}>Monthly</span>
          <div
            className={`toggle-track${annual ? ' on' : ''}`}
            onClick={() => setAnnual(!annual)}
          >
            <div className="toggle-thumb"></div>
          </div>
          <span className={`toggle-label${annual ? ' active' : ''}`}>
            Annual <span className="save-badge">Save 25%</span>
          </span>
        </div>

        <div className="price-grid">
          <div className="pc">
            <p className="pc-tier">Free</p>
            <div className="pc-price">$0</div>
            <p className="pc-period">forever — no card required</p>
            <ul className="pc-list">
              <li>Prompt Architect — 20 prompts/mo</li>
              <li>Manuscript Studio — 5 drafts/mo</li>
              <li>Creator OS — 3 video exports/mo</li>
              <li className="off">Voice profile training</li>
              <li className="off">Sovereign Prose Validator</li>
              <li className="off">KDP Launch Walkthrough</li>
              <li className="off">HeyGen avatar integration</li>
            </ul>
            <a href="#" className="btn-tier bt-outline">Start Free</a>
          </div>

          <div className="pc featured">
            <div className="pc-badge">MOST POPULAR</div>
            <p className="pc-tier">Pro</p>
            <div className="pc-price">{annual ? '$29' : '$39'}</div>
            <p className="pc-period">{annual ? 'per month, billed $348/yr' : 'per month'}</p>
            <ul className="pc-list">
              <li>Prompt Architect — unlimited</li>
              <li>Manuscript Studio — unlimited drafts</li>
              <li>Creator OS — 30 video exports/mo</li>
              <li>Voice profile training</li>
              <li>Sovereign Prose Validator</li>
              <li>KDP Launch Walkthrough</li>
              <li className="off">HeyGen avatar integration</li>
            </ul>
            <a href="#" className="btn-tier bt-solid">Get Pro</a>
          </div>

          <div className="pc">
            <p className="pc-tier">Studio</p>
            <div className="pc-price">{annual ? '$59' : '$79'}</div>
            <p className="pc-period">{annual ? 'per month, billed $708/yr' : 'per month'}</p>
            <ul className="pc-list">
              <li>Everything in Pro</li>
              <li>Creator OS — unlimited exports</li>
              <li>HeyGen avatar integration</li>
              <li>Priority AI processing</li>
              <li>Multi-project workspace</li>
              <li>Early access to new stack tools</li>
              <li>Founder-level support channel</li>
            </ul>
            <a href="#" className="btn-tier bt-outline">Get Studio</a>
          </div>
        </div>
      </div>
    </section>
  )
}
