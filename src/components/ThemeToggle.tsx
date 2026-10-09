"use client";

import { useSyncExternalStore } from "react";

// Dark / light switch. The theme lives on <html data-theme> (set before first
// paint by the inline script in layout.tsx) and the choice is remembered in
// localStorage on this device. Switching cross-fades via the View
// Transitions API where the browser supports it.
export type Theme = "dark" | "light";
export const THEME_KEY = "oxify-theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function applyTheme(next: Theme) {
  const set = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore — the switch still works for this visit
    }
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "startViewTransition" in document) {
    document.startViewTransition(set);
  } else {
    set();
  }
}

const SUN = "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42";
const MOON = "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z";

// `labels`: "always" shows "Dark" / "Light" next to the icons (sign-in page);
// "desktop" shows them from 720px up and icons only on phones (dashboard
// header, where a long customer name needs the room).
export default function ThemeToggle({ labels = "always" }: { labels?: "always" | "desktop" }) {
  // Server (and hydration) render as dark; React re-renders with the real
  // theme right after, so the markup never mismatches.
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => "dark");
  const labelClass = labels === "always" ? "" : "hidden min-[720px]:inline";

  const option = (value: Theme, text: string, path: string) => {
    const active = theme === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={`${text} theme`}
        title={`${text} theme`}
        onClick={() => !active && applyTheme(value)}
        className={
          "relative z-[1] flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold tracking-[0.2px] transition-colors duration-300 " +
          (labels === "always" ? "px-4 " : "px-2.5 min-[720px]:px-3.5 ") +
          (active ? "text-on-accent" : "text-muted hover:text-ink")
        }
      >
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={path} />
        </svg>
        <span className={labelClass}>{text}</span>
      </button>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="relative inline-grid grid-cols-2 items-center rounded-full border border-line-strong bg-panel p-0.5 shadow-(--shadow-panel)"
    >
      {/* Gold thumb that slides under the active option (each option is
          exactly half the width, so 100% of its own width = one option). */}
      <span
        aria-hidden="true"
        className={
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-accent-fill shadow-[0_0_14px_rgba(205,181,132,calc(.45*var(--glow-k)))] transition-transform duration-300 ease-out " +
          (theme === "light" ? "translate-x-full" : "translate-x-0")
        }
      />
      {option("dark", "Dark", MOON)}
      {option("light", "Light", SUN)}
    </div>
  );
}
