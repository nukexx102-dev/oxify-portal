"use client";

import { useEffect } from "react";

// Drives the "alive" effects in globals.css:
// - reveals .ox-reveal elements as they scroll into view (staggered when
//   several arrive together, e.g. on first load)
// - adds a gold ripple to .ox-sheen / .ox-ripple buttons on tap
// - fills the reading-progress bar as the page scrolls (one update per
//   frame, written only onto the bar itself)
// Nothing here runs on mouse movement. Does nothing for visitors who prefer
// reduced motion.
export default function Alive() {
  useEffect(() => {
    const root = document.documentElement;
    // Tells the startup script's 5s safety check that the reveals are running.
    (window as Window & { __oxAlive?: boolean }).__oxAlive = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The head script sets this before first paint; set it again here in
    // case React re-created <html> after a hydration mismatch.
    root.classList.add("ox-anim");

    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, k) => {
            const el = e.target as HTMLElement;
            el.style.setProperty("--d", `${k * 90}ms`);
            el.classList.add("is-in");
            io.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    const seen = new WeakSet<Element>();
    const scan = () =>
      document.querySelectorAll(".ox-reveal:not(.is-in)").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    scan();
    // The dashboard replaces the sign-in form without a navigation.
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".ox-sheen, .ox-ripple");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "ox-ripple-dot";
      dot.setAttribute("aria-hidden", "true");
      dot.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${size}px;height:${size}px`;
      el.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    };

    const progress = document.querySelector<HTMLElement>(".ox-progress");
    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame || !progress) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const max = root.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`;
      });
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(scrollFrame);
    };
  }, []);

  return <div className="ox-progress" aria-hidden="true" />;
}
