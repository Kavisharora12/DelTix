"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Calculator,
  Lock,
  Sparkles,
  Zap,
  CheckCircle2,
  X,
  ChevronDown,
  Play,
  Layers,
  XCircle,
} from "lucide-react";
import { StickmanStory } from "@/components/animation/stickman-story";
import { InteractiveSimulator } from "@/components/animation/interactive-simulator";
import { Button } from "@/components/ui/button";
import { useTourStore } from "@/lib/tour-store";

const SAMPLE_PROMPTS = [
  {
    label: "E-Com Refunds",
    prompt:
      "Refund e-commerce orders under $50 automatically via PayPal; escalate >$50 to manager",
    spendCap: "$500.00",
    threshold: "$50.00",
  },
  {
    label: "Vendor Invoicing",
    prompt:
      "Verify incoming vendor invoice against signed PO line items using exact Decimal math; disburse up to $250 automatically",
    spendCap: "$2,500.00",
    threshold: "$250.00",
  },
  {
    label: "Dispute Mitigation",
    prompt:
      "Check PayPal chargeback against delivery confirmation transcript; auto-credit customer concession if trust score > 0.9",
    spendCap: "$400.00",
    threshold: "$40.00",
  },
];

const STACK_LOGOS = [
  { name: "PayPal", sub: "SANDBOX & PAYOUTS" },
  { name: "LangGraph", sub: "CHECKPOINTS" },
  { name: "Supabase", sub: "POSTGRESQL" },
  { name: "Go 1.24", sub: "GATEWAY" },
  { name: "Python AST", sub: "DECIMAL MATH" },
  { name: "Upstash", sub: "REDIS" },
  { name: "Gemini", sub: "COMPILER" },
  { name: "HMAC-SHA256", sub: "DUAL-KEY" },
];

const INVARIANT_CARDS_TOP = [
  {
    tag: "01 / DECIMAL AST",
    title: "Zero Floating-Point Drift",
    quote:
      "Every invoice line item, tax rate, and refund amount is evaluated in exact Python Decimal AST — never LLM mental math.",
    meta: "0.00% Variance Tolerance",
  },
  {
    tag: "02 / DAG COMPILER",
    title: "Kahn Cycle-Free Graphs",
    quote:
      "Natural-language prompts compile into topologically sorted DAGs so agents can never enter infinite payout loops.",
    meta: "Guaranteed Termination",
  },
  {
    tag: "03 / POLICY MATRIX",
    title: "Fail-Closed Spend Caps",
    quote:
      "Per-run ceilings, daily velocity limits, and vendor allowlists are enforced outside the LLM before any gateway call.",
    meta: "Zero DB Lock Contention",
  },
  {
    tag: "04 / DUAL-KEY HMAC",
    title: "Cryptographic Separation",
    quote:
      "Initiators cannot approve their own payouts. Approvers inspect grounded citations and mint signed HMAC-SHA256 tokens.",
    meta: "SOC2 Dual-Key Control",
  },
];

const INVARIANT_CARDS_BOTTOM = [
  {
    tag: "05 / CHECKPOINTING",
    title: "Durable Human Pause",
    quote:
      "High-value runs serialize full LangGraph state snapshots and resume seamlessly seconds or days after manager signoff.",
    meta: "PostgreSQL State Store",
  },
  {
    tag: "06 / PII REDACTION",
    title: "Sanitized Audit Streams",
    quote:
      "Card numbers, bearer tokens, and sensitive customer fields are automatically masked before entering logs or SSE streams.",
    meta: "Auto-Sanitized Telemetry",
  },
  {
    tag: "07 / IDEMPOTENCY",
    title: "Exactly-Once Settlement",
    quote:
      "Deterministic idempotency keys guarantee a retried network call never double-charges or double-refunds a customer.",
    meta: "99.99% Settlement Safety",
  },
  {
    tag: "08 / LIVE SSE",
    title: "Real-Time Node Telemetry",
    quote:
      "Stream every AST evaluation, policy check, and PayPal adapter response live to the operator console as it happens.",
    meta: "Sub-50ms Event Stream",
  },
];

const PILLAR_CARDS = [
  {
    step: "PILLAR 01",
    badge: "0.00% VARIANCE",
    title: "Deterministic AST Math Engine",
    subtitle: "Exact Python Decimal Evaluation • Zero LLM Arithmetic",
    description:
      "LLM mental math is strictly prohibited. Numbers are extracted into high-precision Python AST Decimals with 0-cent variance tolerance before entering policy gates.",
    highlights: [
      "Strict AST expression parsing",
      "0-cent rounding tolerance",
      "Auditable calculation trace",
    ],
    ctaLabel: "Test Math Guardrails",
    href: "/studio/new",
    icon: Calculator,
    topOffset: "top-24",
  },
  {
    step: "PILLAR 02",
    badge: "FAIL-CLOSED",
    title: "Fail-Closed Policy Matrix",
    subtitle: "External Spend Caps • Daily Velocity • Vendor Allowlists",
    description:
      "Company spend caps, daily volume velocity, and vendor allowlists are enforced outside the model. Any policy exception pauses execution safely without holding DB locks.",
    highlights: [
      "Enforced outside LLM context",
      "Durable LangGraph pause",
      "Instant threshold escalation",
    ],
    ctaLabel: "Configure Policies",
    href: "/policies",
    icon: ShieldCheck,
    topOffset: "top-28",
  },
  {
    step: "PILLAR 03",
    badge: "HMAC-SHA256",
    title: "Dual-Key Cryptographic Signoff",
    subtitle: "Separation of Duties • Grounded Citations • Signed Payouts",
    description:
      "Initiators cannot approve their own runs. Approvers inspect grounded citations and mint signed HMAC-SHA256 tokens required by the payout gateway.",
    highlights: [
      "Role-separated approval queue",
      "Signed HMAC payout tokens",
      "Immutable audit trail",
    ],
    ctaLabel: "Inspect Approval Queue",
    href: "/approvals",
    icon: Lock,
    topOffset: "top-32",
  },
];

const FAQS = [
  {
    q: "How does DelTix prevent LLM math hallucinations on invoices and payouts?",
    a: "LLM arithmetic is never trusted for financial calculations. DelTix parses monetary values into a Python AST Decimal evaluator with 0-cent variance tolerance before any spend gate or PayPal payout executes.",
  },
  {
    q: "What happens when an agent tries to exceed a company spend cap?",
    a: "The Fail-Closed Policy Matrix blocks execution outside the model, writes a durable LangGraph checkpoint, and routes the run to Dual-Key Human Approval without holding database locks.",
  },
  {
    q: "Can the person who triggered a payout also approve it?",
    a: "No. DelTix enforces cryptographic separation of duties: initiators cannot approve their own runs. Approvers inspect grounded citations and mint signed HMAC-SHA256 tokens required by the payout gateway.",
  },
  {
    q: "Can I test workflows before connecting production PayPal accounts?",
    a: "Yes. Every workspace starts in Sandbox mode with PayPal Sandbox adapters, live SSE execution telemetry, and unlimited agent compilations at $0/mo.",
  },
  {
    q: "How are sensitive card numbers and auth headers handled?",
    a: "All payment instruments, PII, and authorization headers are automatically redacted before entering audit logs, LLM traces, or SSE streams.",
  },
];

/** Sheryians-style bordered badge/highlight with 4 square corner handles */
function CornerBox({
  children,
  variant = "dark",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "dark" | "light";
  className?: string;
}) {
  const dotColor = variant === "light" ? "bg-black/75" : "bg-white";
  return (
    <span
      className={`relative inline-block w-fit bg-[#E8602E21] border border-[#E8602E] px-2.5 py-0.5 ${className}`}
    >
      <span
        className={`pointer-events-none absolute top-0 left-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 ${dotColor}`}
      />
      <span
        className={`pointer-events-none absolute top-0 right-0 h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2 ${dotColor}`}
      />
      <span
        className={`pointer-events-none absolute bottom-0 left-0 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 ${dotColor}`}
      />
      <span
        className={`pointer-events-none absolute bottom-0 right-0 h-1.5 w-1.5 translate-x-1/2 translate-y-1/2 ${dotColor}`}
      />
      {children}
    </span>
  );
}

/** Dual-text vertical slide label for buttons & nav links */
function SlideText({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative overflow-hidden inline-block align-middle">
      <span className="flex items-center gap-2 transition-transform duration-300 ease-out group-hover:-translate-y-full">
        {children}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center gap-2 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0"
      >
        {children}
      </span>
    </span>
  );
}

/** Sheryians-style gradient button with dual-text vertical slide hover animation */
function SlideButton({
  href,
  onClick,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const classes = `group sheryians-cta inline-flex items-center justify-center rounded-2xl text-white font-semibold cursor-pointer ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        <SlideText>{children}</SlideText>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      <SlideText>{children}</SlideText>
    </button>
  );
}

/** Sheryians-style scroll reveal (blur + translateY + opacity) */
function RevealOnScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${visible ? "reveal-visible" : "reveal-hidden"} ${className}`}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { startTour } = useTourStore();
  const [activeTab, setActiveTab] = useState<
    "playground" | "story" | "simulator"
  >("playground");
  const [playgroundPrompt, setPlaygroundPrompt] = useState(
    SAMPLE_PROMPTS[0].prompt
  );
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [navVisible, setNavVisible] = useState(true);
  const [reelGlow, setReelGlow] = useState({ x: 50, y: 50 });
  const pageRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = pageRootRef.current?.closest("main") || window;
    const getScrollTop = () =>
      scrollEl === window
        ? window.scrollY
        : (scrollEl as HTMLElement).scrollTop;

    let lastY = getScrollTop();
    const onScroll = () => {
      const currentY = getScrollTop();
      if (currentY <= 40) {
        setNavVisible(true);
      } else if (currentY > lastY + 4) {
        setNavVisible(false);
      } else if (currentY < lastY - 4) {
        setNavVisible(true);
      }
      lastY = currentY;
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  const handleLaunchTour = () => {
    startTour();
    router.push("/dashboard");
  };

  const handleSelectPreset = (idx: number) => {
    setActivePresetIndex(idx);
    setPlaygroundPrompt(SAMPLE_PROMPTS[idx].prompt);
  };

  return (
    <div
      ref={pageRootRef}
      className="min-h-screen bg-black text-white flex flex-col relative z-0 overflow-x-clip"
    >
      {/* Exact Sheryians Full-Bleed Hero Background Framing */}
      <div className="pointer-events-none absolute w-full top-0 left-0 z-0 overflow-hidden">
        <img
          src="/hero-bg.svg"
          alt=""
          aria-hidden
          className="w-full brightness-110 scale-110 h-[120vh] md:h-[165vh] object-cover object-[60%_60%] select-none"
        />
      </div>
      {/* Fixed Transparent Navbar (Exact Sheryians: no navbar background, disappears on scroll down) */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-20 bg-transparent transition-all duration-300 ${
          navVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-10 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center shrink-0">
            <img
              src="/deltix-logo.svg"
              alt="DelTix"
              className="h-8 w-auto object-contain"
            />
          </Link>

          {/* Centered Dark Pill Navigation (#0C0C0C with subtle white outline) */}
          <nav className="hidden md:flex items-center gap-8 py-2.5 px-7 rounded-lg bg-[#0C0C0C] border border-white/15 tracking-wide text-[14px] text-white/70">
            <Link
              href="/"
              className="group text-white transition-colors"
            >
              <SlideText>Home</SlideText>
            </Link>
            <Link
              href="/studio/new"
              className="group hover:text-white transition-colors"
            >
              <SlideText>Studio</SlideText>
            </Link>
            <Link
              href="/sandbox"
              className="group hover:text-white transition-colors"
            >
              <SlideText>Sandbox</SlideText>
            </Link>
            <Link
              href="/dashboard"
              className="group hover:text-white transition-colors"
            >
              <SlideText>Console</SlideText>
            </Link>
          </nav>

          {/* Right Actions with Sheryians slide & glow effects */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="group hidden sm:inline-flex items-center px-4 py-2 rounded-full bg-[#4B1E0E] border border-[#E8602E] text-[13px] font-medium text-white hover:bg-[#5e2612] hover:shadow-[0_0_24px_rgba(232,96,46,0.45)] transition-all duration-300"
            >
              <SlideText>Request Demo</SlideText>
            </button>
            <Link
              href="/login"
              className="group inline-flex items-center px-4 py-2 rounded-lg bg-transparent text-white text-[13px] font-medium hover:bg-[#E8602E] hover:shadow-[0_0_24px_rgba(232,96,46,0.5)] transition-all duration-300"
            >
              <SlideText>Sign In</SlideText>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section over Full-Bleed Background SVG */}
      <section className="relative z-10 bg-transparent">
        <div
          aria-hidden
          className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[920px] h-[460px] rounded-full bg-[radial-gradient(circle,rgba(232,96,46,0.18)_0%,rgba(232,96,46,0.05)_45%,transparent_72%)] blur-2xl animate-glow-pulse"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-32 pb-16 sm:pt-36 sm:pb-20 text-center space-y-6 animate-fade-in-up">
          {/* Eyebrow (Exact Sheryians 19.58px) */}
          <h4 className="font-sans text-base sm:text-[19.58px] font-normal tracking-wide uppercase text-[#E8602E] leading-[1.333] drop-shadow-[0_0_16px_rgba(232,96,46,0.45)]">
            COMPILE. VERIFY. DISBURSE.
          </h4>

          {/* Concise Display H1 (Exact Sheryians Neue Machina 400, 61.36px, -0.025em, 65.28px line-height + luminous sheen) */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[61.36px] font-normal tracking-[-0.025em] leading-[1.064] max-w-4xl mx-auto text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.22)]">
            <span className="bg-gradient-to-b from-white via-white to-white/75 bg-clip-text text-transparent">
              Deterministic Agents For{" "}
            </span>
            <CornerBox className="mx-1.5 my-0.5 text-white font-display font-normal drop-shadow-[0_0_20px_rgba(232,96,46,0.45)]">
              Zero-Risk
            </CornerBox>{" "}
            <span className="bg-gradient-to-b from-white via-white to-white/75 bg-clip-text text-transparent">
              Payouts.
            </span>
          </h1>

          {/* Concise Subtitle (Exact Sheryians Manrope 300, 24.8px) */}
          <p className="font-sans text-base sm:text-[24.8px] font-light text-white/75 max-w-2xl mx-auto leading-[1.5]">
            Compile natural language into verified payment DAGs with exact
            Decimal math and dual-key signoff.
          </p>

          {/* Social Proof Stack */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <div className="flex -space-x-2.5">
              {["DT", "PG", "HK", "AI"].map((initials, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-full border-2 border-black bg-gradient-to-br from-[#E8602E] to-[#340E00] flex items-center justify-center text-[10px] font-bold text-white"
                >
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-xs sm:text-sm text-white/75">
              <strong className="text-white font-semibold">14,200+</strong>{" "}
              Dual-Key Approvals Verified in Production
            </span>
          </div>

          {/* Primary Slide CTA + Secondary Tour CTA */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <SlideButton
              href="/studio/new"
              className="px-8 py-3.5 text-sm sm:text-base"
            >
              <span>Start Building</span>
              <ArrowRight className="h-4 w-4" />
            </SlideButton>

            <button
              type="button"
              onClick={handleLaunchTour}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0C0C0C] hover:bg-white/[0.08] border border-white/15 text-white text-sm font-medium transition-colors"
            >
              <Play className="h-3.5 w-3.5 text-[#E8602E]" />
              <span>Interactive Console Tour</span>
            </button>
          </div>
        </div>
      </section>

      {/* Exact Sheryians Bento Showcase Card + Infinite Tech Marquee */}
      <RevealOnScroll className="relative z-10">
        <section className="px-4 sm:px-6 pb-12">
          <div
            className="w-full lg:w-[80%] max-w-[1135px] mx-auto border border-[#302C2A] rounded-2xl p-5 md:p-7 flex lg:flex-row flex-col gap-6 items-stretch backdrop-blur-[20px]"
            style={{
              boxShadow:
                "0px 4px 7px 0px rgba(0, 0, 0, 0.05), 0px 4px 4px 0px rgba(0, 0, 0, 0.1), 0px 4px 4px 0px rgba(0, 0, 0, 0.05), inset 0px 1px 68.7px 0px rgb(48, 44, 42)",
            }}
          >
            {/* Left Grid: 2 Top Stat Cards + 1 Bottom Statement Card */}
            <div className="w-full lg:w-1/2 grid grid-cols-1 md:grid-cols-2 md:grid-rows-[246px_246px] gap-5">
              {/* Stat Card 1 */}
              <div className="rounded-2xl bg-transparent border border-[#302C2A] p-5 flex flex-col justify-between min-h-[220px] md:min-h-0">
                <div>
                  <div
                    className="font-sans text-[40px] lg:text-[42px] font-normal leading-none tracking-[-0.05em] tabular-nums inline-block"
                    style={{
                      background:
                        "linear-gradient(rgb(255, 112, 60) 28.05%, rgb(153, 67, 36) 100%) text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    $42.8M+
                  </div>
                  <p className="font-sans text-[16px] font-extralight leading-[1.4] text-white mt-2">
                    Disbursed Safely
                  </p>
                </div>
                <p className="font-sans text-[16px] font-normal leading-[1.375] text-white mt-auto pt-6">
                  Deterministic execution across every verified PayPal payout.
                </p>
              </div>

              {/* Stat Card 2 */}
              <div className="rounded-2xl bg-transparent border border-[#302C2A] p-5 flex flex-col justify-between min-h-[220px] md:min-h-0">
                <div>
                  <div
                    className="font-sans text-[40px] lg:text-[42px] font-normal leading-none tracking-[-0.05em] tabular-nums inline-block"
                    style={{
                      background:
                        "linear-gradient(rgb(255, 112, 60) 28.05%, rgb(153, 67, 36) 100%) text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    0.00%
                  </div>
                  <p className="font-sans text-[16px] font-extralight leading-[1.4] text-white mt-2">
                    Math Variance
                  </p>
                </div>
                <p className="font-sans text-[16px] font-normal leading-[1.375] text-white mt-auto pt-6">
                  Exact Python AST Decimal verification on every workflow run.
                </p>
              </div>

              {/* Bottom Statement Card */}
              <div className="rounded-2xl bg-transparent md:col-span-2 border border-[#302C2A] p-5 flex flex-col justify-between min-h-[220px] md:min-h-0">
                <div className="flex flex-col items-start gap-2">
                  <span className="font-sans font-light text-[34px] sm:text-[42px] leading-none text-white">
                    DEPLOY YOUR
                  </span>
                  <Link
                    href="/studio/new"
                    className="group inline-flex items-center pl-[68px] pr-2.5 h-9 rounded-full border border-[#E8602E] bg-transparent hover:bg-[#E8602E]/15 text-white transition-all duration-300"
                    aria-label="Enter Studio"
                  >
                    <span className="font-sans text-[38px] font-light leading-none -mt-1.5 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </Link>
                </div>
                <div className="font-sans font-light text-[32px] sm:text-[42px] leading-[1.08] text-white">
                  ZERO-RISK PAYMENT AGENTS WITH US!
                </div>
              </div>
            </div>

            {/* Right Column: Auto-Playing Looping DelTix Reel Card */}
            <Link
              href="/studio/new"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setReelGlow({
                  x: ((e.clientX - rect.left) / rect.width) * 100,
                  y: ((e.clientY - rect.top) / rect.height) * 100,
                });
              }}
              className="w-full lg:w-1/2 rounded-2xl bg-black border border-[#302C2A] hover:border-[#E8602E]/60 relative overflow-hidden min-h-[380px] lg:min-h-[512px] group cursor-pointer transition-colors duration-300"
            >
              {/* Auto-playing looping MP4 video with smooth hover zoom */}
              <video
                src="/deltix-reel.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="pointer-events-none absolute inset-0 w-full h-full object-cover object-center opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out"
              />

              {/* Interactive cursor-tracking burnt-orange spotlight */}
              <div
                aria-hidden
                style={{
                  background: `radial-gradient(280px circle at ${reelGlow.x}% ${reelGlow.y}%, rgba(232,96,46,0.22), transparent 70%)`,
                }}
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />

              {/* Top & bottom readability scrim */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/70"
              />

              {/* Subtle Geometric Wireframe Overlay */}
              <svg
                aria-hidden
                viewBox="0 0 400 360"
                className="pointer-events-none absolute inset-0 w-full h-full opacity-25 group-hover:opacity-40 transition-opacity duration-500"
                fill="none"
              >
                <circle
                  cx="320"
                  cy="70"
                  r="95"
                  stroke="#E8602E"
                  strokeWidth="1"
                />
                <rect
                  x="210"
                  y="190"
                  width="150"
                  height="150"
                  stroke="#E8602E"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="90"
                  x2="400"
                  y2="90"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.75"
                />
                <line
                  x1="140"
                  y1="0"
                  x2="140"
                  y2="360"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.75"
                />
              </svg>

              {/* Top-left Title (Exact Sheryians 39.17px Manrope 300) */}
              <h1 className="font-sans text-[39.17px] font-light leading-none text-white absolute top-5 left-5 z-10">
                Start
                <br />
                Building
              </h1>
            </Link>
          </div>

          {/* Exact Sheryians Monochrome Logo Marquee (borderless, edge-faded, 24s) */}
          <div
            className="group/marquee py-10 overflow-hidden mt-8"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <div className="flex w-max animate-marquee-left items-center">
              {[...STACK_LOGOS, ...STACK_LOGOS].map((logo, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-10 sm:px-14 opacity-50 hover:opacity-90 transition-opacity whitespace-nowrap select-none"
                >
                  <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                    {logo.name}
                  </span>
                  <span className="text-[9px] font-mono tracking-widest text-white/60 border-l border-white/25 pl-2.5 uppercase">
                    {logo.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealOnScroll>

      {/* Rounded-4xl #FFF3EF Warm Cream Section (Visual Story Guide) */}
      <RevealOnScroll>
      <section id="platform" className="px-2 sm:px-4 py-6">
        <div className="max-w-6xl mx-auto rounded-[28px] bg-[#FFF3EF] text-black px-4 sm:px-10 py-14 space-y-8">
          <div className="text-center space-y-2.5 max-w-2xl mx-auto">
            <CornerBox
              variant="light"
              className="text-[11px] font-mono uppercase tracking-widest text-[#E8602E] font-semibold"
            >
              STORY GUIDE
            </CornerBox>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[44px] font-normal tracking-[-0.025em] leading-[1.1] text-black">
              See How DelTix Executes Safely
            </h2>
            <p className="text-base font-light text-black/70">
              Walk through the visual story guide from prompt compilation to
              dual-key settlement.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <StickmanStory />
          </div>
        </div>
      </section>
      </RevealOnScroll>

      {/* Exact Sheryians Comparison Section */}
      <RevealOnScroll>
      <section
        id="comparison"
        className="max-w-5xl mx-auto px-4 sm:px-6 py-20 space-y-10"
      >
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <CornerBox className="text-[11px] font-mono uppercase tracking-widest text-[#E8602E]">
            COMPARISON
          </CornerBox>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-normal tracking-[-0.025em] leading-[1.1] text-white">
            What Sets DelTix Apart From Generic AI Agents
          </h2>
        </div>

        {/* Single Outer Rounded Container */}
        <div className="rounded-3xl border border-white/10 bg-[#050507] p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* Left Highlighted DelTix Card with Fading Green Border */}
          <div className="p-[1px] rounded-2xl bg-gradient-to-b from-[#69E82E]/65 via-[#69E82E]/25 to-transparent shadow-[0_0_28px_rgba(105,232,46,0.14)]">
            <div className="h-full bg-black rounded-2xl p-6 sm:p-10 space-y-7">
              <div className="flex items-center">
                <img
                  src="/deltix-logo.svg"
                  alt="DelTix"
                  className="h-8 w-auto object-contain"
                />
              </div>

              <ul className="space-y-5 text-sm sm:text-[15px] text-white/90 font-normal">
                {[
                  "Exact Python Decimal AST math with 0-cent variance",
                  "Kahn topological DAG verification (zero infinite loops)",
                  "Fail-closed spend caps & vendor allowlists outside the LLM",
                  "Dual-key human-in-the-loop pause with HMAC-SHA256 signoff",
                  "Automatic PII redaction & immutable audit ledger",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Others Column (clean, no inner box, XCircle icons) */}
          <div className="p-6 sm:p-10 space-y-7">
            <div className="flex items-center gap-3">
              <Layers className="h-6 w-6 text-white" />
              <h3 className="font-sans text-xl sm:text-2xl font-normal text-white">
                Others
              </h3>
            </div>

            <ul className="space-y-5 text-sm sm:text-[15px] text-white/80 font-normal">
              {[
                "Probabilistic floating-point arithmetic & rounding drift",
                "Unbounded agent loops that can re-trigger payouts",
                "Prompt-only guardrails easily bypassed by edge cases",
                "No separation of duties or cryptographic approval tokens",
                "Raw logs exposing payment metadata and auth headers",
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3.5">
                  <XCircle className="h-5 w-5 text-[#E8602E] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      </RevealOnScroll>

      {/* FAQ Accordion Section */}
      <section
        id="faqs"
        className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 space-y-6"
      >
        <div className="text-center space-y-2">
          <CornerBox className="text-[11px] font-mono uppercase tracking-widest text-[#E8602E]">
            FAQS
          </CornerBox>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[44px] font-normal tracking-[-0.025em] leading-[1.1] text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#0C0C0C] border border-white/10 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-semibold text-white">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-white/60 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[#E8602E]" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-4 text-xs sm:text-sm text-white/65 leading-relaxed border-t border-white/5 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Book Enterprise Demo Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0C0C0C] border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Book Enterprise Institutional Demo
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Consult with DelTix financial engineers on SOC2 compliance and
                  spend caps.
                </p>
              </div>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="text-white/50 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-white/70 mb-1">
                  Company Email
                </label>
                <input
                  type="email"
                  placeholder="controller@acmepayments.com"
                  className="w-full px-3 py-2 bg-black border border-white/15 rounded-lg text-white font-mono focus:outline-none focus:border-[#E8602E]"
                />
              </div>
              <div>
                <label className="block text-white/70 mb-1">
                  Estimated Monthly Disbursement
                </label>
                <select className="w-full px-3 py-2 bg-black border border-white/15 rounded-lg text-white focus:outline-none focus:border-[#E8602E]">
                  <option>&lt; $100,000 USD / month</option>
                  <option>$100,000 – $1,000,000 USD / month</option>
                  <option>&gt; $1,000,000 USD / month</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDemoModalOpen(false)}
              >
                Cancel
              </Button>
              <SlideButton
                onClick={() => {
                  alert(
                    "Thank you! A DelTix financial engineer will contact you shortly."
                  );
                  setDemoModalOpen(false);
                }}
                className="px-4 py-1.5 text-xs"
              >
                <span>Schedule Demo Session</span>
              </SlideButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
