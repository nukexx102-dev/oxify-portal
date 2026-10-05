"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { DashboardData } from "@/lib/clickup";
import Dashboard from "@/components/Dashboard";
import { CONTACT } from "@/lib/portalContent";

// "Remember me" — fully automatic: a returning customer with a remembered
// order on this device lands straight on their dashboard, no form, no
// click needed. localStorage only (this device), not a server-side
// session — fine for this low-sensitivity, no-password use case. The
// checkbox on the form lets a customer on a shared device opt out.
const REMEMBER_KEY = "oxify-portal-lookup";

type Remembered = { orderNumber: string; email: string };

function readRemembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.orderNumber === "string" && typeof parsed?.email === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null; // private browsing / storage disabled / corrupt value
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
  // Computed once, synchronously, via a lazy initializer — not in an
  // effect — so there's no setState-in-effect render cascade for the part
  // that doesn't need to be async.
  const [remembered] = useState<Remembered | null>(() => readRemembered());
  const [orderNumber, setOrderNumber] = useState(remembered?.orderNumber ?? "");
  const [email, setEmail] = useState(remembered?.email ?? "");
  // Explicit opt-in/opt-out toggle, defaulting on — a customer on a shared
  // device can switch it off before submitting so nothing gets saved (and
  // won't auto-log-in next visit on that device).
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  // While we try the automatic login, show a blank/loading screen instead
  // of the form — avoids a flash of the empty form before silently
  // jumping to the dashboard.
  const [checkingRemembered, setCheckingRemembered] = useState(remembered !== null);

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
    if (!remembered) return; // checkingRemembered already initialized to false
    (async () => {
      try {
        const result = await fetchOrder(remembered.orderNumber, remembered.email);
        if (result.status === "ok") {
          setDashboard(result.data);
        } else {
          // Silent auto-login: on failure, just forget it and show the
          // normal empty form — no error message for something the
          // customer didn't actively submit themselves.
          clearRemembered();
        }
      } catch {
        clearRemembered();
      } finally {
        setCheckingRemembered(false);
      }
    })();
  }, [remembered]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await fetchOrder(orderNumber, email);
      if (result.status === "ok") {
        setDashboard(result.data);
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
    setDashboard(null);
    setOrderNumber("");
    setEmail("");
  }

  if (checkingRemembered) {
    return <main className="flex-1" />;
  }

  if (dashboard) {
    return <Dashboard data={dashboard} onReset={handleReset} />;
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-[18px] py-16">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-10">
        <Image
          src="/oxify-logo-white.png"
          alt="Oxify"
          width={1000}
          height={359}
          priority
          className="h-[34px] w-auto"
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-[10.5px] font-semibold uppercase tracking-[2px] text-accent">{CONTACT.tagline}</span>
          <h1 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-1.2px] text-ink">
            Track your order
          </h1>
          <p className="max-w-[40ch] text-pretty text-[15px] font-light leading-[1.6] text-body">
            Enter your order number and the email on your order to see live status,
            delivery dates, and your documents.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-4 rounded-2xl border border-line bg-panel p-6 backdrop-blur-md min-[720px]:p-7"
        >
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-muted">Order number</span>
            <input
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. OXFY1020"
              autoCapitalize="characters"
              className="min-h-12 rounded-[10px] border border-line-strong bg-tile px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-disabled focus:border-accent"
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
              className="min-h-12 rounded-[10px] border border-line-strong bg-tile px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-disabled focus:border-accent"
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
            className="mt-1 min-h-12 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent transition-all duration-200 hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(205,181,132,.95),0_0_18px_rgba(205,181,132,.6),0_0_42px_rgba(205,181,132,.35)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
          >
            {submitting ? "Looking up your order…" : "Track my order"}
          </button>

          {error && (
            <p role="alert" className="rounded-[10px] border border-warning/30 bg-warning/8 px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink">
              {error}
            </p>
          )}
        </form>

        <p className="text-center text-[12px] leading-[1.7] text-muted">
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
