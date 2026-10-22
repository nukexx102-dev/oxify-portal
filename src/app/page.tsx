"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DashboardData } from "@/lib/clickup";
import Dashboard, { Logo } from "@/components/Dashboard";
import ThemeToggle from "@/components/ThemeToggle";
import { CONTACT } from "@/lib/portalContent";

// "Remember me" — fully automatic: a returning customer with a remembered
// order on this device lands straight on their dashboard, no form, no
// click needed. localStorage only (this device), not a server-side
// session — fine for this low-sensitivity, no-password use case. The
// checkbox on the form lets a customer on a shared device opt out.
const REMEMBER_KEY = "oxify-portal-lookup";

type Remembered = { orderNumber: string; email: string };

// What the server (and the browser's first, hydrating render) sees: the
// saved order hasn't been read yet. Both render the same blank screen, so
// the HTML matches; React then re-renders with the real value.
const NOT_READ_YET = "\u0000not-read-yet";
const subscribeNoop = () => () => {};

// "Track my order" in the forgot-order-number email links to /?order=…,
// which prefills the order number (read after hydration, like the above).
function readOrderParam(): string {
  const v = new URLSearchParams(window.location.search).get("order") ?? "";
  return /^#?[A-Za-z0-9-]{1,24}$/.test(v) ? v : "";
}

function readStored(): string | null {
  try {
    return localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null; // private browsing / storage disabled
  }
}

function parseRemembered(raw: string | null): Remembered | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.orderNumber === "string" && typeof parsed?.email === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null; // corrupt value
  }
}

function writeRemembered(value: Remembered) {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(value));
  } catch {
    // ignore — remembering is a convenience, not a requirement
  }
}

function clearRemembered() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // ignore
  }
}

const card =
  "ox-card ox-reveal flex w-full flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-(--shadow-panel) min-[720px]:p-7";
const input =
  "min-h-12 rounded-[10px] border border-line-strong bg-tile light:bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-disabled focus:border-accent";
const goldButton =
  "ox-sheen mt-1 min-h-12 rounded-[10px] bg-accent-fill px-4 text-[14px] font-semibold text-on-accent transition-all duration-200 hover:-translate-y-px hover:bg-accent-fill-hover hover:shadow-[0_0_0_1px_rgba(205,181,132,calc(.95*var(--glow-k))),0_0_18px_rgba(205,181,132,calc(.6*var(--glow-k))),0_0_42px_rgba(205,181,132,calc(.35*var(--glow-k)))] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none";
const textLink =
  "self-center rounded px-1 py-0.5 text-[12.5px] text-muted underline underline-offset-[3px] transition-colors hover:text-accent";

export default function LookupPage() {
  // Read localStorage only after hydration — reading it during the first
  // render made the server HTML (the form) differ from the browser's (the
  // blank checking screen), which React reports as a hydration error.
  const stored = useSyncExternalStore(subscribeNoop, readStored, () => NOT_READ_YET);
  const remembered = useMemo(() => (stored === NOT_READ_YET ? null : parseRemembered(stored)), [stored]);
  const orderParam = useSyncExternalStore(subscribeNoop, readOrderParam, () => "");
  // null = untouched, so the ?order= prefill shows until the customer types.
  const [orderNumberInput, setOrderNumber] = useState<string | null>(null);
  const orderNumber = orderNumberInput ?? orderParam;
  const [email, setEmail] = useState("");
  // "forgot" = the "Forgot your order number?" form; "sent" = its answer.
  const [mode, setMode] = useState<"lookup" | "forgot" | "sent">("lookup");
  // Explicit opt-in/opt-out toggle, defaulting on — a customer on a shared
  // device can switch it off before submitting so nothing gets saved (and
  // won't auto-log-in next visit on that device).
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  // While we try the automatic login (or haven't read storage yet), show a
  // blank/loading screen instead of the form — avoids a flash of the empty
  // form before silently jumping to the dashboard.
  const [autoLoginDone, setAutoLoginDone] = useState(false);
  const checkingRemembered = !autoLoginDone && (stored === NOT_READ_YET || remembered !== null);

  // Pure fetch — no setState calls in here. Callers each decide what to
  // do with the result, so setState always happens directly in the
  // caller's own closure rather than being hidden inside a shared
  // function reference (the react-hooks/set-state-in-effect lint rule
  // flags calling a state-mutating function reference from an effect).
  async function fetchOrder(
    orderNumberValue: string,
    emailValue: string
  ): Promise<{ status: "ok"; data: DashboardData } | { status: "not_found" | "rate_limited" | "error" }> {
    const res = await fetch("/api/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: orderNumberValue, email: emailValue }),
    });

    if (res.status === 404) return { status: "not_found" };
    if (res.status === 429) return { status: "rate_limited" };
    if (!res.ok) return { status: "error" };
    return { status: "ok", data: (await res.json()) as DashboardData };
  }

  useEffect(() => {
    if (autoLoginDone || !remembered) return; // nothing saved: checkingRemembered is already false
    let cancelled = false;
    (async () => {
      let data: DashboardData | null = null;
      try {
        const result = await fetchOrder(remembered.orderNumber, remembered.email);
        if (result.status === "ok") data = result.data;
      } catch {
        // treated like a failed lookup below
      }
      if (cancelled) return;
      if (data) {
        setDashboard(data);
      } else {
        // Silent auto-login: on failure, just forget it and show the
        // normal form (prefilled) — no error message for something the
        // customer didn't actively submit themselves.
        clearRemembered();
        setOrderNumber(remembered.orderNumber);
        setEmail(remembered.email);
      }
      setAutoLoginDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [remembered, autoLoginDone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await fetchOrder(orderNumber, email);
      if (result.status === "ok") {
        setDashboard(result.data);
        // Saving below must not re-trigger the automatic login.
        setAutoLoginDone(true);
        if (rememberMe) {
          writeRemembered({ orderNumber, email });
        } else {
          clearRemembered();
        }
      } else if (result.status === "not_found") {
        setError(
          "We couldn't find an order matching that order number and email. Double-check both, or contact us below."
        );
      } else if (result.status === "rate_limited") {
        setError("Too many attempts — please wait a few minutes and try again, or contact us below.");
      } else {
        setError(
          "Something went wrong looking up your order. Try again in a moment, or contact us below."
        );
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMode("sent");
      } else if (res.status === 429) {
        setError("Too many attempts — please wait a few minutes and try again, or contact us below.");
      } else if (res.status === 400) {
        setError("Please enter a valid email address.");
      } else {
        setError("Something went wrong. Try again in a moment, or contact us below.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: "lookup" | "forgot") {
    setError(null);
    setMode(next);
  }

  function handleReset() {
    clearRemembered();
    setAutoLoginDone(true);
    setDashboard(null);
    setMode("lookup");
    setOrderNumber("");
    setEmail("");
  }

  if (dashboard) {
    return <Dashboard data={dashboard} onReset={handleReset} />;
  }

  if (checkingRemembered) {
    return <main className="flex-1" />;
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-[18px] py-16">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-10">
        <span className="ox-reveal">
          <Logo priority className="h-[34px] w-auto" />
        </span>

        <div className="ox-reveal flex flex-col items-center gap-3 text-center">
          <span className="text-[10.5px] font-semibold uppercase tracking-[2px] text-accent">{CONTACT.tagline}</span>
          <h1 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-1.2px] text-ink">
            {mode === "lookup" ? "Track your order" : mode === "forgot" ? "Find your order number" : "Check your inbox"}
          </h1>
          <p className="max-w-[40ch] text-pretty text-[15px] font-light leading-[1.6] text-body">
            {mode === "lookup"
              ? "Enter your order number and the email on your order to see live status, delivery dates, and your documents."
              : mode === "forgot"
                ? "Enter the email address you used when you placed your order, and we'll send your order number to it."
                : `If ${email.trim() || "that email"} matches an Oxify order, we've sent your order number to it. It can take a minute to arrive — check your spam folder too.`}
          </p>
        </div>

        {/* Theme choice, right above the lookup card. */}
        <div className="ox-reveal -mb-4 flex justify-center">
          <ThemeToggle />
        </div>

        {mode === "lookup" && (
          <form onSubmit={handleSubmit} className={card}>
            <label className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-muted">Order number</span>
              <input
                required
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. OXFY1020"
                autoCapitalize="characters"
                className={input}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-muted">Email on the order</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={input}
              />
            </label>

            <label className="flex items-center gap-2.5 py-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-[12.5px] text-body">Remember me on this device</span>
            </label>

            <button type="submit" disabled={submitting} className={goldButton}>
              {submitting ? "Looking up your order…" : "Track my order"}
            </button>

            {error && (
              <p role="alert" className="rounded-[10px] border border-warning/30 bg-warning/8 px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink">
                {error}
              </p>
            )}

            <button type="button" onClick={() => switchMode("forgot")} className={textLink}>
              Forgot your order number?
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot} className={card}>
            <label className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-muted">Email on the order</span>
              <input
                required
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={input}
              />
              <span className="text-[12px] leading-[1.5] text-muted">
                Use the same email you used at checkout. It&apos;s the one your order confirmation was sent to.
              </span>
            </label>

            <button type="submit" disabled={submitting} className={goldButton}>
              {submitting ? "Sending…" : "Email my order number"}
            </button>

            {error && (
              <p role="alert" className="rounded-[10px] border border-warning/30 bg-warning/8 px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink">
                {error}
              </p>
            )}

            <button type="button" onClick={() => switchMode("lookup")} className={textLink}>
              ← Back to sign in
            </button>
          </form>
        )}

        {mode === "sent" && (
          <div className={card}>
            <p className="text-[13px] leading-[1.6] text-body">
              Nothing after a few minutes? You may have used a different email when you ordered. Try another
              one, or contact us below.
            </p>
            <button type="button" onClick={() => switchMode("forgot")} className={goldButton}>
              Try a different email
            </button>
            <button type="button" onClick={() => switchMode("lookup")} className={textLink}>
              ← Back to sign in
            </button>
          </div>
        )}

        <p className="ox-reveal text-center text-[12px] leading-[1.7] text-muted">
          Can&apos;t find your order? Call{" "}
          <a href={`tel:${CONTACT.phoneTel}`} className="text-ink underline underline-offset-[3px] hover:text-accent">
            {CONTACT.phoneDisplay}
          </a>{" "}
          or email{" "}
          <a href={`mailto:${CONTACT.email}`} className="text-ink underline underline-offset-[3px] hover:text-accent">
            {CONTACT.email}
          </a>
          <br />
          {CONTACT.hours}
        </p>
      </div>
    </main>
  );
}
