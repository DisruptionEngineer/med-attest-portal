import Link from 'next/link';
import { ArrowRight, ShieldCheck, FileSignature, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed]">
      {/* Nav */}
      <nav className="flex items-center justify-between max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </div>
          <span className="text-base font-extrabold tracking-tight">med-attest</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm text-[#8888a0] hover:text-[#e8e8ed] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/20 transition-all"
          >
            Get a DID <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#2a2a38] bg-[#1a1a24] text-xs text-[#8888a0] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          Pilot research preview — not for clinical use
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-5">
          A HIPAA consent story
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            for your AI tool.
          </span>
        </h1>
        <p className="text-lg text-[#8888a0] max-w-xl mx-auto mb-9 leading-relaxed">
          med-attest is a patient-controlled consent broker for AI tools reading EHR data. Sign up,
          checkout, get a DID — your tool authenticates against the broker and reads patient data
          under signed grants. Every call lands a cryptographic receipt the patient can verify.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/sign-up"
            className="px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:shadow-xl hover:shadow-indigo-500/25 hover:-translate-y-0.5 transition-all"
          >
            Start the pilot →
          </Link>
          <Link
            href="#how-it-works"
            className="px-7 py-3 rounded-xl border border-[#2a2a38] text-sm text-[#e8e8ed] hover:border-[#555568] transition-colors"
          >
            How it works
          </Link>
        </div>
      </section>

      {/* Flow Diagram */}
      <section className="max-w-3xl mx-auto px-6 pb-20" id="how-it-works">
        <div className="rounded-2xl border border-[#2a2a38] bg-[#111118] p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.06)_0%,transparent_50%)]" />
          <div className="flex items-center justify-between gap-4 relative z-10 flex-wrap">
            {[
              { icon: '🔐', label: 'Checkout', sub: 'Stripe pilot tier' },
              { icon: '🆔', label: 'DID minted', sub: 'did:jwk + private key', highlight: true },
              { icon: '🤝', label: 'Patient grants', sub: 'Wallet-signed scope' },
              { icon: '📜', label: 'Receipts', sub: 'Anchored on-chain' },
            ].map((node, i) => (
              <div key={node.label} className="flex items-center gap-4">
                <div
                  className={`p-3.5 rounded-xl border text-center min-w-[120px] ${
                    node.highlight
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[#2a2a38] bg-[#1a1a24]'
                  }`}
                >
                  <div className="text-xl mb-1.5">{node.icon}</div>
                  <div className="text-xs font-semibold">{node.label}</div>
                  <div className="text-[10px] text-[#555568]">{node.sub}</div>
                </div>
                {i < 3 && <span className="text-[#555568] text-lg hidden md:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <Zap className="w-5 h-5" />,
              color: 'text-indigo-400 bg-indigo-500/10',
              title: 'Touchless signup',
              desc: 'Stripe checkout → Ed25519 keypair → broker allowlist → welcome email. No sales call, no manual approval.',
            },
            {
              icon: <ShieldCheck className="w-5 h-5" />,
              color: 'text-green-400 bg-green-500/10',
              title: 'Patient-signed consent',
              desc: 'Patients authorize via a PWA wallet — every grant is a W3C VC they signed and can revoke. Your tool sees only what the patient said yes to.',
            },
            {
              icon: <FileSignature className="w-5 h-5" />,
              color: 'text-violet-400 bg-violet-500/10',
              title: 'Verifiable receipts',
              desc: 'Every tool call lands a broker-signed receipt batched into a Merkle tree and anchored on Cheqd. Auditors verify independently.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-[#2a2a38] bg-[#1a1a24]"
            >
              <div
                className={`w-9 h-9 rounded-lg mb-3.5 flex items-center justify-center ${feature.color}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-sm font-bold mb-1.5">{feature.title}</h3>
              <p className="text-xs text-[#8888a0] leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a24] px-6 py-8 text-center text-xs text-[#555568]">
        <p>
          med-attest pilot · not for clinical use ·{' '}
          <a
            href="https://github.com/DisruptionEngineer/med-attest"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[#8888a0]"
          >
            source
          </a>
        </p>
      </footer>
    </div>
  );
}
