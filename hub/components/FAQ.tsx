'use client'
import { useState } from 'react'

const FAQS = [
  {
    q: 'Do I need all three tools?',
    a: 'No. Each tool in the stack works independently. You can use Manuscript Studio without Creator OS, or Prompt Architect on its own. The stack pricing bundles all three at a discount — but the tools are designed to stand alone.',
  },
  {
    q: 'What makes Sovereign Prose Validator different?',
    a: "It scores writing for somatic interiority — the depth of physical and felt experience in the prose — not just grammar or clarity. It's a proprietary scoring layer built specifically for fiction and narrative nonfiction authors, with a methodology grounded in the author's own training and publishing experience.",
  },
  {
    q: 'Is the stack built on top of ChatGPT?',
    a: "No. Creator Stack runs on Anthropic's Claude API — the same sovereign AI infrastructure underlying Sovereign Shield Technologies' broader platform. This is a deliberate choice: Claude's constitutional AI approach aligns with the platform's values around safety, sovereignty, and responsible AI deployment.",
  },
  {
    q: 'Can the stack be acquired separately from Sovereign Shield?',
    a: "Yes. Creator Stack is a distinct business unit — three SaaS products with shared infrastructure. Sovereign Shield Technologies' GPU cloud thesis, tribal technology partnerships, and Chickasaw Nation sovereign infrastructure work are separate and not part of any creator stack transaction.",
  },
  {
    q: 'When will Stripe checkout be live?',
    a: 'Stripe billing infrastructure is built and operational within Manuscript Studio OS today. Full unified billing across all three tools under one Creator Stack subscription is in active development. Waitlist users will be first to access it at launch pricing.',
  },
  {
    q: "What's the voice profile training feature?",
    a: 'You upload a sample of your writing — fiction, nonfiction, essays, anything. Manuscript Studio analyzes your voice: sentence rhythm, interiority patterns, vocabulary tendencies. Every draft it generates afterward is calibrated to sound like you, not like a generic AI output.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq">
      <div className="container">
        <p className="sec-label">FAQ</p>
        <h2 className="sec-title" style={{ marginBottom: '48px' }}>Common questions.</h2>
        <div className="faq-grid">
          {FAQS.map((faq, i) => (
            <div key={i} className={`faq-item${open === i ? ' open' : ''}`}>
              <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
                {faq.q} <span className="faq-icon">+</span>
              </button>
              <div className="faq-a">{faq.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
