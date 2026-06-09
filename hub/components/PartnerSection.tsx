'use client'
import { useState } from 'react'

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/REPLACE_WITH_YOUR_FORM_ID'

export default function PartnerSection() {
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      if (res.ok) setSubmitted(true)
    } catch {
      setSubmitted(true)
    }
  }

  return (
    <section id="partner">
      <div className="container">
        <div className="partner-inner">
          <div className="partner-text">
            <p className="sec-label">For Partners &amp; Acquirers</p>
            <h2 className="sec-title">The stack is acquirable. The mission is not.</h2>
            <p>
              Creator Stack is a portfolio of three live, revenue-ready SaaS products built on a
              shared AI infrastructure layer. Each product has its own user base, pricing model, and
              distribution wedge. Together they represent a consolidated creator platform with
              immediate cross-sell potential.
            </p>
            <p><strong>What comes with the stack:</strong></p>
            <ul className="partner-points">
              <li>Three deployed Next.js applications with Prisma, Supabase, and Anthropic AI</li>
              <li>Stripe billing infrastructure across Free, Pro, and Studio tiers</li>
              <li>Sovereign Prose Validator — a proprietary somatic interiority scoring model</li>
              <li>41,000+ sovereign AI training pairs powering the voice-matching layer</li>
              <li>KDP publishing pipeline with end-to-end launch walkthrough</li>
              <li>HeyGen avatar video integration — a differentiated moat in the creator video space</li>
              <li>Manuscript Studio OS live domain and existing author user base</li>
              <li>Full codebase, IP, and brand assets transfer on close</li>
            </ul>
            <p>
              Sovereign Shield Technologies retains its GPU cloud infrastructure thesis and Chickasaw
              Nation tribal technology partnerships. This is a creator software acquisition — the
              sovereign infrastructure layer is not for sale.
            </p>
            <p>
              <strong>Ideal partners:</strong> creator economy platforms, AI writing tool companies,
              edtech or publishing SaaS looking to expand into creator tooling, strategic acquirers
              in the $5M–$25M range.
            </p>
            <a
              href="mailto:matt@sovereignshieldtechnologies.com"
              className="btn-main"
              style={{ display: 'inline-block', marginTop: '8px' }}
            >
              Email Us Directly
            </a>
          </div>

          <div className="partner-form">
            <div className="pf-title">Partner Inquiry</div>
            <p className="pf-sub">
              Whether you&apos;re exploring acquisition, licensing, or a strategic partnership —
              start here. We respond within 48 hours.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="pf-row">
                <div className="pf-field">
                  <label>First Name</label>
                  <input type="text" name="firstName" placeholder="Jane" required />
                </div>
                <div className="pf-field">
                  <label>Last Name</label>
                  <input type="text" name="lastName" placeholder="Smith" required />
                </div>
              </div>
              <div className="pf-field">
                <label>Company / Fund</label>
                <input type="text" name="company" placeholder="Acme Capital" required />
              </div>
              <div className="pf-field">
                <label>Email</label>
                <input type="email" name="email" placeholder="jane@acmecapital.com" required />
              </div>
              <div className="pf-field">
                <label>Inquiry Type</label>
                <select name="inquiryType" required defaultValue="">
                  <option value="" disabled>Select interest</option>
                  <option>Full Stack Acquisition</option>
                  <option>Individual Product Licensing</option>
                  <option>Strategic Partnership / Revenue Share</option>
                  <option>Investment Inquiry</option>
                  <option>White-label / Enterprise License</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="pf-field">
                <label>Tell us about the opportunity</label>
                <textarea
                  name="message"
                  placeholder="Brief overview of your interest, budget range, and timeline..."
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-submit"
                disabled={submitted}
                style={submitted ? { background: '#1A2E2A', color: 'var(--teal)' } : undefined}
              >
                {submitted ? 'Inquiry Sent ✓' : 'Send Inquiry'}
              </button>
              <p
                className="pf-note"
                style={submitted ? { color: 'var(--teal)' } : undefined}
              >
                {submitted
                  ? 'We received your message. Expect a reply within 48 hours.'
                  : 'All inquiries are reviewed by the founder directly. NDA available on request.'}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
