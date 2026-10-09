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

export default function LookupPage() {
  // Read localStorage only after hydration — reading it during the first
  // render made the server HTML (the form) differ from the browser's (the
  // blank checking screen), which React reports as a hydration error.
  const stored = useSyncExternalStore(subscribeNoop, readStored, () => NOT_READ_YET);
  const remembered = useMemo(() => (stored === NOT_READ_YET ? null : parseRemembered(stored)), [stored]);
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
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

  function handleReset() {
    clearRemembered();
    setAutoLoginDone(true);
    setDashboard(null);
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
            Track your order
          </h1>
          <p className="max-w-[40ch] text-pretty text-[15px] font-light leading-[1.6] text-body">
            Enter your order number and the email on your order to see live status,
            delivery dates, and your documents.
          </p>
        </div>

        {/* Theme choice, right above the lookup card. */}
        <div className="ox-reveal -mb-4 flex justify-center">
          <ThemeToggle />
        </div>

        <form
          onSubmit={handleSubmit}
          className="ox-card ox-reveal flex w-full flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-(--shadow-panel) min-[720px]:p-7"
        >
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-muted">Order number</span>
            <input
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. OXFY1020"
              autoCapitalize="characters"
              className="min-h-12 rounded-[10px] border border-line-strong bg-tile light:bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-disabled focus:border-accent"
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
              className="min-h-12 rounded-[10px] border border-line-strong bg-tile light:bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-disabled focus:border-accent"
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

          <button
            type="submit"
            disabled={submitting}
            className="ox-sheen mt-1 min-h-12 rounded-[10px] bg-accent-fill px-4 text-[14px] font-semibold text-on-accent transition-all duration-200 hover:-translate-y-px hover:bg-accent-fill-hover hover:shadow-[0_0_0_1px_rgba(205,181,132,calc(.95*var(--glow-k))),0_0_18px_rgba(205,181,132,calc(.6*var(--glow-k))),0_0_42px_rgba(205,181,132,calc(.35*var(--glow-k)))] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
          >
            {submitting ? "Looking up your order…" : "Track my order"}
          </button>

          {error && (
            <p role="alert" className="rounded-[10px] border border-warning/30 bg-warning/8 px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink">
              {error}
            </p>
          )}
        </form>

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
