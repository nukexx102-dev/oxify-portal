"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { DashboardData } from "@/lib/clickup";
import { CONTACT, DELIVERY, JOURNEY, JOURNEY_PHASES, PRODUCTS, SHARED_DOCS } from "@/lib/portalContent";

type Props = {
  data: DashboardData;
  onReset: () => void;
};

// 24×24 line icons (stroke 1.6, round caps) — paths from the Claude Design file.
const ICONS = {
  production: "M2 20h20M4 20V9l5 3.5V9l5 3.5V6l6 4v10M8.5 16h.01M12.5 16h.01M16.5 16h.01",
  box: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  anchor: "M12 22V8M5 12H2a10 10 0 0020 0h-3M12 8a3 3 0 100-6 3 3 0 000 6",
  calendar: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18M9 15.5l2 2 4-4",
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
  chamber: "M12 2a7 7 0 00-7 7v6a7 7 0 0014 0V9a7 7 0 00-7-7zM5 12h14",
  config: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5M18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5",
  tracking: "M12 22a10 10 0 100-20 10 10 0 000 20M12 8v4l3 2",
  window: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18",
  serial: "M4 7V4h16v3M9 20h6M12 4v16",
  manual: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5zM9 7h7M9 11h5",
  safety: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01",
  customs: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  protocol: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
  electrical: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  refresh: "M21 12a9 9 0 11-2.64-6.36M21 3v6h-6",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, size = 20, strokeWidth = 1.6, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// Statuses where an unpaid Initial Deposit balance is actually blocking
// progress — production is done and it needs paying off before delivery.
// Earlier statuses don't nag the customer yet.
const BALANCE_DUE_STATUSES = new Set(["ready to ship", "in transit", "customs clearance", "delivery scheduled"]);

const panel = "rounded-2xl border border-line bg-panel backdrop-blur-md";
const eyebrow = "text-[10px] font-semibold uppercase tracking-[1.8px]";

function firstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

function lastCheckedNow(): string {
  // Always Eastern Time — Oxify's support hours are EST — not each visitor's
  // device timezone. "America/New_York" handles EST/EDT on its own.
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
}

export default function Dashboard({ data, onReset }: Props) {
  const { order, copy, kind, currentStepIndex } = data;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lastChecked] = useState(lastCheckedNow);

  const product = PRODUCTS[order.chamberModel];
  const chamberName = product?.name ?? order.chamberModel;
  const coordFirst = firstName(order.coordinatorName);
  const fillCoord = (s: string) =>
    s.replace(/^\{coord\}/, coordFirst ?? "Your order specialist").replaceAll("{coord}", coordFirst ?? "your order specialist");

  if (kind === "exception") {
    return (
      <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <Image src="/oxify-logo-white.png" alt="Oxify" width={1000} height={359} className="h-[34px] w-auto" />
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.8px] text-ink">{copy.heroHeadline}</h1>
          <p className="text-[15px] font-light text-body">{copy.heroSub}</p>
          <p className={`${panel} p-6 text-left text-[14px] font-light leading-[1.7] text-body`}>{fillCoord(copy.whatHappensNext)}</p>
          <ContactButtons coordFirst={null} />
          <button onClick={onReset} className="text-[12px] font-medium text-muted underline underline-offset-[3px] hover:text-ink">
            Look up a different order
          </button>
        </div>
      </main>
    );
  }

  const isDelayed = order.delayAlert;
  const status = isDelayed
    ? { label: "Delayed", tone: "warning" as const }
    : order.status === "delivered"
      ? { label: "Delivered", tone: "accent" as const }
      : order.status === "delivery scheduled"
        ? { label: "Scheduled", tone: "accent" as const }
        : { label: "On Track", tone: "accent" as const };

  const hasWaterChiller = order.configuration.some((c) => /water chiller/i.test(c));
  const detailRows: { icon: IconName; label: string; value: string; note?: string; muted?: boolean; href?: string }[] = [
    { icon: "chamber", label: "Chamber", value: chamberName || "—", note: product?.spec },
  ];
  if (order.chamberColor) detailRows.push({ icon: "chamber", label: "Color", value: order.chamberColor });
  if (order.configuration.length > 0) {
    detailRows.push({ icon: "config", label: "Configuration", value: order.configuration.join(" · ") });
  }
  detailRows.push({ icon: "truck", label: "Delivery", value: DELIVERY.label, note: DELIVERY.note });
  detailRows.push(
    order.trackingLink
      ? /^https?:\/\//i.test(order.trackingLink)
        ? { icon: "tracking", label: "Tracking", value: "Track your shipment", href: order.trackingLink }
        : { icon: "tracking", label: "Tracking", value: order.trackingLink }
      : {
          icon: "tracking",
          label: "Tracking",
          value: "Available once your chamber is picked up",
          muted: true,
          note: "A tracking number appears here once the truck picks up your order.",
        }
  );
  detailRows.push({
    icon: "window",
    label: "Delivery window",
    value: order.deliveryWindow ?? "TBD",
    muted: !order.deliveryWindow,
  });
  if (order.packageCount != null || hasWaterChiller) {
    detailRows.push({
      icon: "box",
      label: "Packages to expect",
      value: order.packageCount != null ? `${order.packageCount} package${order.packageCount === 1 ? "" : "s"}` : "TBD",
      muted: order.packageCount == null,
      note: hasWaterChiller
        ? "Your water chiller/AC ships separately due to inspection requirements. That's normal — nothing is missing."
        : undefined,
    });
  }
  if (order.serialNumber) detailRows.push({ icon: "serial", label: "Serial number", value: order.serialNumber });

  const documents: { icon: IconName; title: string; note: string; href: string | null }[] = [
    {
      icon: "manual",
      title: chamberName ? `${chamberName} User Manual` : "User Manual",
      note: "Setup, daily operation, cleaning, and care for your specific model.",
      href: order.userManualUrl,
    },
    {
      icon: "safety",
      title: "HBOT Safety Checklist",
      note: "Pre-session checks and what should never come inside the chamber.",
      href: SHARED_DOCS.safetyChecklist || null,
    },
    {
      icon: "electrical",
      title: "Electrical Requirements",
      note: "Outlet, circuit, and power specs to have ready in your space before delivery day.",
      href: order.electricalRequirementsUrl,
    },
    {
      icon: "protocol",
      title: "Digital Protocol Book",
      note: "Session length, pressure, and frequency guidance to build your routine.",
      href: SHARED_DOCS.protocolBook || null,
    },
  ];

  // From the order's "Order Photos" field in ClickUp, streamed through our
  // own /api/orders/photo proxy since ClickUp file links can expire.
  const photos: Photo[] = order.photos.map((p) => ({
    src: `/api/orders/photo?taskId=${encodeURIComponent(order.taskId)}&attachmentId=${encodeURIComponent(p.id)}`,
    alt: p.title,
  }));

  const showBalanceDue =
    order.paymentTerms === "Initial Deposit" &&
    (BALANCE_DUE_STATUSES.has(order.status) || order.delayReason === "Remaining Balance Needed");
  const showSplitPayments = order.paymentTerms?.startsWith("Split Payments");

  return (
    <main className="mx-auto w-full max-w-[1080px] flex-1 px-[18px] pb-[72px] min-[720px]:px-10">
      {/* Header */}
      <header className="flex flex-col items-start gap-4 pb-5 pt-[22px] min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between min-[720px]:gap-6 min-[720px]:pb-[30px] min-[720px]:pt-[34px]">
        <Image src="/oxify-logo-white.png" alt="Oxify" width={1000} height={359} priority className="h-7 w-auto min-[720px]:h-[34px]" />
        <div className="flex flex-col gap-1 min-[720px]:items-end">
          <span className="text-[14px] font-semibold text-ink">{order.customerName}</span>
          <span className="text-[12px] text-muted tabular-nums">Order {order.orderNumber}</span>
        </div>
      </header>

      {/* Status row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span
          className={
            "inline-flex items-center gap-2 rounded-full border py-1.5 pl-[11px] pr-[14px] " +
            (status.tone === "warning" ? "border-warning/35 bg-warning/8" : "border-accent/35 bg-accent/8")
          }
        >
          <span
            className={
              "h-[7px] w-[7px] flex-none rounded-full [animation:ox-pulse_2.2s_ease-out_infinite] " +
              (status.tone === "warning" ? "bg-warning text-warning/45" : "bg-accent text-accent/45")
            }
          />
          <span className={"text-[12px] font-semibold tracking-[0.3px] " + (status.tone === "warning" ? "text-warning" : "text-accent")}>
            {status.label}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-[7px] text-muted">
            <Icon name="refresh" size={13} strokeWidth={1.9} />
            <span className="text-[11.5px] tabular-nums">Last checked {lastChecked}</span>
          </span>
          <button
            type="button"
            onClick={onReset}
            className="text-[11.5px] font-medium text-muted underline underline-offset-[3px] transition-colors hover:text-ink"
          >
            Look up a different order
          </button>
        </div>
      </div>

      {/* Delay notice — only when ops has flagged this order */}
      {isDelayed && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/8 p-4">
          <span className="mt-0.5 text-warning">
            <Icon name="alert" size={18} strokeWidth={1.8} />
          </span>
          <p className="text-[13.5px] leading-relaxed text-ink">
            {order.delayReason ? (
              <>
                <span className="font-semibold">Your order is delayed:</span> {order.delayReason}. Contact us below if you have any questions.
              </>
            ) : (
              <>
                <span className="font-semibold">Your order has been flagged as delayed.</span> Contact us below and we&apos;ll explain what&apos;s going on.
              </>
            )}
          </p>
        </div>
      )}

      {/* Hero */}
      <section className="pb-1 pt-5 min-[720px]:pb-3 min-[720px]:pt-7">
        <h1 className="mb-4 max-w-[15ch] text-balance text-[32px] font-semibold leading-[1.04] tracking-[-1px] text-ink min-[720px]:text-[52px] min-[720px]:tracking-[-2px]">
          {copy.heroHeadline}
        </h1>
        <p className="max-w-[56ch] text-pretty text-[15px] font-light leading-[1.6] text-body min-[720px]:text-[17px]">{copy.heroSub}</p>
      </section>

      {order.hasModelPhoto && (
        <ModelShowcase
          taskId={order.taskId}
          name={chamberName || "Your chamber"}
          spec={product?.spec}
          about={product?.about}
          color={order.chamberColor}
          configuration={order.configuration}
        />
      )}

      {/* Order details — right under the headline so a customer can confirm
          early that this is their order. Collapsed by default. */}
      <section className={`${panel} mt-4 px-5 pb-5 pt-[22px] min-[720px]:px-[30px] min-[720px]:pb-[26px] min-[720px]:pt-7`}>
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex min-h-6 w-full items-center justify-between gap-4 text-left"
        >
          <h2 className="text-[18px] font-medium tracking-[-0.3px] text-ink">Your Order Details</h2>
          <span className="flex items-center gap-[9px] text-muted">
            <span className="text-[12px] font-medium tabular-nums">{detailRows.length} items</span>
            <Icon name="chevronDown" size={14} strokeWidth={2} className={"transition-transform duration-200 " + (detailsOpen ? "rotate-180" : "")} />
          </span>
        </button>
        {detailsOpen && (
          <dl className="pt-[18px] [animation:ox-fade_260ms_ease_both]">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 items-start gap-2 border-t border-divider py-[17px] min-[720px]:grid-cols-[210px_minmax(0,1fr)] min-[720px]:items-center min-[720px]:gap-6"
              >
                <dt className="flex items-center gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] border border-line-strong bg-tile text-accent">
                    <Icon name={row.icon} size={15} />
                  </span>
                  <span className="text-[12.5px] font-medium text-muted">{row.label}</span>
                </dt>
                <dd className="flex flex-col gap-[5px] pl-11 min-[720px]:pl-0">
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-accent hover:text-accent-hover"
                    >
                      {row.value}
                      <Icon name="arrowRight" size={14} strokeWidth={1.8} />
                    </a>
                  ) : (
                    <span className={"text-[14.5px] font-medium tabular-nums " + (row.muted ? "text-muted" : "text-ink")}>{row.value}</span>
                  )}
                  {row.note && <span className="text-[12.5px] font-light leading-normal text-body">{row.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Photos from the order's Order Photos field, under the details. */}
      {photos.length > 0 && <PhotoCarousel photos={photos} />}

      <JourneyPanel currentStepIndex={currentStepIndex} />

      {/* Balance due — only once it's actually blocking delivery */}
      {showBalanceDue && (
        <section className="mt-4 rounded-2xl border border-danger/35 bg-danger/8 px-5 py-[22px] min-[720px]:px-[26px]">
          <div className="mb-2 flex items-center gap-2.5 text-danger">
            <Icon name="alert" size={18} strokeWidth={1.8} />
            <h2 className="text-[17px] font-medium tracking-[-0.2px] text-ink">Complete your remaining balance</h2>
          </div>
          <p className="max-w-[62ch] text-[14px] font-light leading-[1.7] text-body">
            {order.remainingBalance != null
              ? `You have a remaining balance of $${order.remainingBalance.toLocaleString("en-US")}. `
              : "You have a remaining balance on this order. "}
            Completing it lets us move your chamber on to the next step.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {order.remainingBalanceLink && (
              <a
                href={order.remainingBalanceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-[10px] bg-accent px-5 text-[13.5px] font-semibold text-on-accent transition-all hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(205,181,132,.95),0_0_18px_rgba(205,181,132,.6)]"
              >
                Pay now
              </a>
            )}
            <a
              href={`mailto:${CONTACT.email}`}
              className="inline-flex min-h-11 items-center rounded-[10px] border border-accent/35 px-5 text-[13.5px] font-medium text-body transition-colors hover:border-accent hover:text-ink"
            >
              Questions? Email us
            </a>
          </div>
        </section>
      )}
      {showSplitPayments && (
        <section className={`${panel} mt-4 px-5 py-[22px] min-[720px]:px-[26px]`}>
          <h2 className="mb-2 text-[17px] font-medium tracking-[-0.2px] text-ink">Payment schedule</h2>
          <p className="max-w-[62ch] text-[14px] font-light leading-[1.7] text-body">
            Your order is on a split payment schedule. Reach out any time for your next payment date and amount.
          </p>
        </section>
      )}

      {/* What happens next + coordinator */}
      <section className="grid grid-cols-1 gap-4 pt-4 min-[900px]:grid-cols-[1.55fr_1fr]">
        <div className={`${panel} px-5 pb-[22px] pt-5 min-[720px]:px-[26px] min-[720px]:pb-[26px] min-[720px]:pt-6`}>
          <h2 className="mb-3 text-[18px] font-medium tracking-[-0.3px] text-ink">What happens next</h2>
          <p className="text-pretty text-[14.5px] font-light leading-[1.7] text-body">{fillCoord(copy.whatHappensNext)}</p>
        </div>
        <div className={`${panel} flex flex-col px-5 pb-[22px] pt-5 min-[720px]:px-[26px] min-[720px]:pb-[26px] min-[720px]:pt-6`}>
          <div className="mb-[22px] flex items-center gap-[13px]">
            {order.coordinatorPhotoUrl ? (
              // A small external avatar — not worth a next/image remote-pattern entry for one host.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.coordinatorPhotoUrl}
                alt={order.coordinatorName ?? "Your order specialist"}
                className="h-11 w-11 flex-none rounded-full border border-accent/35 object-cover"
              />
            ) : (
              <div className="grid h-11 w-11 flex-none place-items-center rounded-full border border-accent/35 bg-[#121722] text-[16px] font-semibold text-accent">
                {order.coordinatorInitials ?? "OX"}
              </div>
            )}
            <div className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-semibold text-ink">{order.coordinatorName ?? "Oxify Support"}</span>
              <span className="text-[12px] text-muted">{order.coordinatorName ? "Your order specialist" : CONTACT.hours}</span>
            </div>
          </div>
          <div className="mt-auto">
            <ContactButtons coordFirst={coordFirst} />
          </div>
        </div>
      </section>

      {/* ETA cards */}
      <section className="grid grid-cols-1 gap-4 pt-4 min-[720px]:grid-cols-2">
        <EtaCard label="Arrives in the U.S." value={order.etaUs} />
        <EtaCard label="Arrives at your door" value={order.etaDoor} />
      </section>

      {/* Documents */}
      <section className={`${panel} mt-4 px-5 pb-6 pt-[22px] min-[720px]:px-[30px] min-[720px]:pb-[30px] min-[720px]:pt-7`}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
          <h2 className="text-[18px] font-medium tracking-[-0.3px] text-ink">Your documents</h2>
          <span className="text-[12px] text-muted">Available now, before delivery</span>
        </div>
        <p className="mb-[22px] max-w-[62ch] text-pretty text-[13.5px] font-light leading-[1.6] text-body">
          A little reading before delivery day makes your first session feel effortless. These stay in your portal for good.
        </p>
        <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
          {documents.map((doc) => {
            const body = (
              <>
                <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] border border-line-strong bg-tile text-accent">
                  <Icon name={doc.icon} size={18} />
                </span>
                <span className="flex min-w-0 flex-col gap-[5px]">
                  <span className="text-[14px] font-semibold leading-[1.3] text-ink">{doc.title}</span>
                  <span className="text-[12.5px] font-light leading-normal text-body">{doc.note}</span>
                  <span className="pt-1">
                    <span
                      className={
                        "inline-block rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.6px] " +
                        (doc.href ? "bg-accent/12 text-accent" : "bg-[#161b26] text-muted")
                      }
                    >
                      {doc.href ? "View document" : "Coming soon"}
                    </span>
                  </span>
                </span>
              </>
            );
            const cls = "flex items-start gap-3.5 rounded-[14px] border border-line bg-doc px-[18px] pb-5 pt-[18px] transition-all duration-200";
            return doc.href ? (
              <a
                key={doc.title}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cls} hover:border-accent/60 hover:shadow-[0_0_26px_rgba(205,181,132,0.25)]`}
              >
                {body}
              </a>
            ) : (
              <div key={doc.title} className={cls} aria-disabled="true">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="pt-11 text-center text-[11.5px] tracking-[0.3px] text-muted">
        Oxify · {CONTACT.tagline} · {CONTACT.portalUrl}
      </footer>
    </main>
  );
}

function ContactButtons({ coordFirst }: { coordFirst: string | null }) {
  return (
    <div className="flex w-full flex-col gap-2.5">
      <a
        href={`mailto:${CONTACT.email}`}
        className="flex min-h-12 w-full items-center justify-center rounded-[10px] bg-accent px-3.5 py-[11px] text-[13.5px] font-semibold tracking-[0.1px] text-on-accent transition-all duration-200 hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(205,181,132,.95),0_0_18px_rgba(205,181,132,.6),0_0_42px_rgba(205,181,132,.35)] min-[720px]:min-h-11"
      >
        {coordFirst ? `Message ${coordFirst}` : "Message us"}
      </a>
      <a
        href={`tel:${CONTACT.phoneTel}`}
        className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-[10px] border border-accent/35 px-3.5 py-[11px] text-[13.5px] font-medium text-body tabular-nums transition-all duration-200 hover:-translate-y-px hover:border-accent hover:bg-accent/6 hover:text-ink hover:shadow-[0_0_0_1px_rgba(205,181,132,.85),0_0_18px_rgba(205,181,132,.45),0_0_40px_rgba(205,181,132,.22)] min-[720px]:min-h-11"
      >
        <span>Call</span>
        <span className="font-semibold text-accent">{CONTACT.phoneDisplay}</span>
      </a>
    </div>
  );
}

// "Where your order is" — the Now/Next row, then one milestone per journey
// status: a horizontal rail on desktop, a vertical rail on mobile. "View the
// full journey" lists every step grouped by phase. In both, a step's
// description shows only while it's hovered — never pinned open by a click
// (on touch screens a tap shows it and tapping elsewhere hides it).
function JourneyPanel({ currentStepIndex }: { currentStepIndex: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const total = JOURNEY.length;
  const last = total - 1;

  const nowLabel = currentStepIndex >= 0 ? JOURNEY[currentStepIndex].label : "Order received";
  const nextLabel = currentStepIndex < last ? JOURNEY[currentStepIndex + 1].label : "Complete";

  return (
    <section id="status" className={`${panel} mt-4 scroll-mt-28 px-5 pb-5 pt-[22px] min-[720px]:px-[30px] min-[720px]:pb-[26px] min-[720px]:pt-7`}>
      <div className="mb-[22px] flex items-baseline justify-between gap-5">
        <h2 className="text-[18px] font-medium tracking-[-0.3px] text-ink">Where your order is</h2>
        <span className="flex-none whitespace-nowrap text-[12px] font-medium text-muted tabular-nums">
          {currentStepIndex >= 0 ? `Step ${currentStepIndex + 1} of ${total}` : "Not started yet"}
        </span>
      </div>

      <div className="flex flex-col">
        {/* Now / Next */}
        <div className="flex flex-col items-start gap-4 border-b border-divider pb-5 min-[720px]:flex-row min-[720px]:items-baseline min-[720px]:justify-between min-[720px]:gap-5 min-[720px]:pb-[22px]">
          <div className="flex flex-col gap-1.5">
            <span className={`${eyebrow} text-accent`}>Now</span>
            <span className="text-[17px] font-semibold tracking-[-0.3px] text-ink">{nowLabel}</span>
          </div>
          <div className="flex flex-col gap-1.5 min-[720px]:items-end">
            <span className={`${eyebrow} text-muted`}>Next</span>
            <span className="text-[15px] text-body">{nextLabel}</span>
          </div>
        </div>

        {/* Milestone rail */}
        <ol className="flex flex-col border-b border-divider pb-4 pt-[18px] min-[720px]:flex-row min-[720px]:items-start min-[720px]:pb-6 min-[720px]:pt-7">
          {JOURNEY.map((step, i) => {
            const done = currentStepIndex > i;
            const current = currentStepIndex === i;
            const open = hovered === i;
            const edge = i === 0 ? "left" : i === last ? "right" : "center";
            return (
              <li key={step.status} className={"flex flex-col min-[720px]:flex-row " + (i === 0 ? "flex-none" : "min-[720px]:flex-1")}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={
                      "ml-[23px] h-4 w-[1.5px] transition-colors duration-200 min-[720px]:ml-0 min-[720px]:mt-[23px] min-[720px]:h-[1.5px] min-[720px]:w-auto min-[720px]:flex-1 " +
                      (currentStepIndex >= i ? "bg-accent/50" : "bg-line-strong")
                    }
                  />
                )}
                <div
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  className={
                    "relative flex flex-none cursor-pointer flex-row items-center gap-3.5 py-1.5 min-[720px]:w-24 min-[720px]:flex-col min-[720px]:gap-[11px] min-[720px]:py-0 " +
                    (open ? "z-20" : "z-[1]")
                  }
                >
                  <span
                    className={
                      "grid h-12 w-12 flex-none place-items-center rounded-full border-[1.5px] transition-all duration-200 " +
                      (open
                        ? "scale-[1.06] border-accent bg-[#141a26] text-accent shadow-[0_0_0_5px_rgba(205,181,132,.14),0_0_22px_rgba(205,181,132,.6),0_0_48px_rgba(205,181,132,.3)]"
                        : current
                          ? "border-accent bg-[#141a26] text-accent shadow-[0_0_0_5px_rgba(205,181,132,.10),0_0_18px_rgba(205,181,132,.28)]"
                          : done
                            ? "border-accent/45 bg-[#1b2230] text-accent"
                            : "border-line-strong bg-[#0d1119] text-muted")
                    }
                  >
                    <Icon name={step.icon} />
                  </span>
                  <span
                    className={
                      "text-[13.5px] leading-[1.35] transition-colors min-[720px]:text-center min-[720px]:text-[11.5px] " +
                      (current ? "font-semibold text-ink" : open ? "text-ink" : done ? "text-body" : "text-muted")
                    }
                  >
                    {step.label}
                  </span>
                  <div
                    role="tooltip"
                    className={
                      "pointer-events-none absolute left-[62px] right-0 top-[calc(100%+2px)] flex flex-col gap-[7px] rounded-xl border border-accent/35 bg-tile px-4 pb-[15px] pt-3.5 text-left shadow-[0_18px_40px_rgba(0,0,0,.55),0_0_24px_rgba(205,181,132,.12)] transition-[opacity,translate] duration-200 min-[720px]:bottom-[calc(100%+14px)] min-[720px]:top-auto min-[720px]:w-[260px] " +
                      (edge === "left"
                        ? "min-[720px]:left-0 min-[720px]:right-auto"
                        : edge === "right"
                          ? "min-[720px]:left-auto min-[720px]:right-0"
                          : "min-[720px]:left-1/2 min-[720px]:right-auto min-[720px]:-translate-x-1/2") +
                      (open ? " translate-y-0 opacity-100" : " translate-y-1.5 opacity-0")
                    }
                  >
                    <span className="flex items-center justify-between gap-2.5">
                      <span className="text-[13px] font-semibold text-ink">{step.label}</span>
                      <span
                        className={
                          "whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[1.2px] " +
                          (current ? "text-accent" : done ? "text-ink" : "text-muted")
                        }
                      >
                        {current ? "Current" : done ? "Complete" : "Upcoming"}
                      </span>
                    </span>
                    <span className="text-[12.5px] leading-[1.55] text-body">{step.tip}</span>
                    <span className="pt-0.5 text-[10.5px] font-medium tracking-[0.3px] text-muted">
                      Step {i + 1} of {total}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        onClick={() => setJourneyOpen((v) => !v)}
        aria-expanded={journeyOpen}
        className="flex min-h-11 w-full items-center justify-between gap-4 pt-3.5 text-left text-[13.5px] font-medium text-ink transition-colors hover:text-accent"
      >
        <span>{journeyOpen ? "Hide the full journey" : "View the full journey"}</span>
        <span className="flex items-center gap-[9px] text-muted">
          <span className="text-[12px] font-medium tabular-nums">All {total} steps</span>
          <Icon name="chevronDown" size={14} strokeWidth={2} className={"transition-transform duration-200 " + (journeyOpen ? "rotate-180" : "")} />
        </span>
      </button>

      {journeyOpen && (
        <div className="relative z-10 grid grid-cols-1 gap-5 pt-[22px] [animation:ox-fade_260ms_ease_both] min-[720px]:grid-cols-3">
          {JOURNEY_PHASES.map((phase) => (
            <div key={phase.title} className="flex flex-col gap-1">
              <span className={`${eyebrow} px-2.5 pb-2 text-muted`}>{phase.title}</span>
              {phase.statuses.map((status) => {
                const i = JOURNEY.findIndex((s) => s.status === status);
                if (i === -1) return null;
                const step = JOURNEY[i];
                const done = currentStepIndex > i;
                const current = currentStepIndex === i;
                return (
                  <div
                    key={status}
                    className={
                      "flex items-center gap-3 rounded-[10px] px-2.5 py-[9px] transition-[background-color,box-shadow] duration-200 hover:bg-accent/8 hover:shadow-[inset_0_0_0_1px_rgba(205,181,132,.4),0_0_20px_rgba(205,181,132,.2)] " +
                      (current ? "bg-accent/6 shadow-[inset_0_0_0_1px_rgba(205,181,132,.25)]" : "")
                    }
                  >
                    {/* Description shows only while the icon is hovered (or
                        reached with the keyboard) — pure CSS, nothing pins. */}
                    <span className="group/tip relative flex-none">
                      <button
                        type="button"
                        aria-label={`${step.label}: ${step.tip}`}
                        className={
                          "grid h-[34px] w-[34px] cursor-default place-items-center rounded-[10px] border transition-all duration-200 hover:border-accent hover:bg-accent/14 hover:text-accent hover:shadow-[0_0_0_4px_rgba(205,181,132,.12),0_0_18px_rgba(205,181,132,.5)] focus-visible:border-accent focus-visible:outline-none " +
                          (current
                            ? "border-accent bg-accent/14 text-accent shadow-[0_0_16px_rgba(205,181,132,.4)]"
                            : done
                              ? "border-accent/35 bg-tile text-accent"
                              : "border-line-strong bg-tile text-muted")
                        }
                      >
                        <Icon name={step.icon} size={16} />
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-[calc(100%+10px)] left-0 z-30 w-[260px] max-w-[calc(100vw-56px)] translate-y-1.5 rounded-xl border border-accent/35 bg-tile px-4 pb-[15px] pt-3.5 text-[12.5px] leading-[1.55] text-body opacity-0 shadow-[0_18px_40px_rgba(0,0,0,.55),0_0_24px_rgba(205,181,132,.12)] transition-[opacity,translate] duration-200 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:translate-y-0 group-has-[:focus-visible]/tip:opacity-100"
                      >
                        {step.tip}
                      </span>
                    </span>
                    <span className={"text-[13.5px] leading-[1.3] " + (current ? "font-semibold text-accent" : done ? "text-ink" : "text-muted")}>
                      {step.label}
                      {current && <span className="ml-2 text-[9.5px] font-semibold uppercase tracking-[1.2px]">Current</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// A showcase of the chamber the customer bought: the photo from the order's
// "🖼️ HBOT Photo (Model)" Drive link on a softly lit stage (zooming in with
// a gold glow on hover), beside the model name, spec line, a short
// description and the configuration. The image is streamed through
// /api/orders/model-photo; if it can't load (e.g. the Drive file isn't
// shared publicly), the whole section quietly disappears.
function ModelShowcase({
  taskId,
  name,
  spec,
  about,
  color,
  configuration,
}: {
  taskId: string;
  name: string;
  spec?: string;
  about?: string;
  color: string | null;
  configuration: string[];
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  if (status === "failed") return null;

  return (
    <section className={`${panel} mt-4 grid grid-cols-1 overflow-hidden min-[720px]:grid-cols-[1.3fr_1fr]`}>
      <div className="group/photo relative aspect-[4/3] overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#1f2738_0%,#0d1119_70%)] min-[720px]:aspect-auto min-[720px]:min-h-[360px]">
        {status === "loading" && <div className="absolute inset-0 animate-pulse bg-white/[0.03]" aria-hidden="true" />}
        {/* Soft gold "floor" light under the chamber. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[7%] left-1/2 h-[16%] w-[68%] -translate-x-1/2 rounded-[50%] bg-accent/20 blur-3xl transition-colors duration-500 group-hover/photo:bg-accent/40"
        />
        {/* The image keeps its own proportions and is framed as a rounded
            card, so studio shots on a light background read as a photo
            rather than a hard-edged white box on the dark stage. */}
        <div className="absolute inset-0 flex items-center justify-center p-5 min-[720px]:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic same-origin proxy URL, not a static asset */}
          <img
            src={`/api/orders/model-photo?taskId=${encodeURIComponent(taskId)}`}
            alt={`${name} hyperbaric chamber`}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("failed")}
            className={
              "max-h-full max-w-full rounded-[18px] object-contain shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_28px_60px_rgba(0,0,0,0.55),0_0_44px_rgba(205,181,132,0.12)] transition-[opacity,scale,box-shadow] duration-500 ease-out group-hover/photo:scale-[1.07] group-hover/photo:shadow-[0_0_0_1px_rgba(205,181,132,0.75),0_28px_60px_rgba(0,0,0,0.55),0_0_32px_rgba(205,181,132,0.55),0_0_90px_rgba(205,181,132,0.3)] " +
              (status === "loaded" ? "scale-100 opacity-100" : "scale-[1.02] opacity-0")
            }
          />
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4 px-5 pb-6 pt-5 min-[720px]:px-9 min-[720px]:py-10">
        <span className={`${eyebrow} text-accent`}>Your hyperbaric chamber</span>
        <div className="flex flex-col gap-2">
          <h2 className="text-balance text-[28px] font-semibold leading-[1.08] tracking-[-0.8px] text-ink min-[720px]:text-[34px] min-[720px]:tracking-[-1.2px]">
            {name}
          </h2>
          {spec && <p className="text-[14px] font-light leading-[1.6] text-body">{spec}</p>}
          {color && (
            <p className="text-[13px] text-muted">
              Color <span className="ml-1 font-medium text-ink">{color}</span>
            </p>
          )}
        </div>
        {configuration.length > 0 && (
          <ul className="flex flex-wrap gap-2 border-t border-divider pt-4" aria-label="Configuration">
            {configuration.map((item) => (
              <li
                key={item}
                className="rounded-full border border-accent/30 bg-accent/6 px-3 py-[5px] text-[12px] font-medium text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
        {about && <p className="text-pretty text-[13.5px] font-light leading-[1.65] text-body">{about}</p>}
      </div>
    </section>
  );
}

function EtaCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={`${panel} flex flex-col gap-2.5 px-5 pb-[22px] pt-5 min-[720px]:px-[26px] min-[720px]:pb-[26px] min-[720px]:pt-6`}>
      <span className={`${eyebrow} text-muted`}>{label}</span>
      <span
        className={
          "text-[23px] font-semibold leading-[1.15] tracking-[-0.8px] tabular-nums min-[720px]:text-[28px] " +
          (value ? "text-ink" : "text-muted")
        }
      >
        {value ?? "TBD"}
      </span>
      <span className="text-[13px] leading-[1.45] text-muted">
        {value ? "Subject to change." : "We'll update this once it's confirmed."}
      </span>
    </div>
  );
}

type Photo = { src: string; alt: string };

// Horizontal snap-scrolling gallery of the order's photos — arrow buttons
// hide themselves at either end, and a fade marks that more is off-screen.
function PhotoCarousel({ photos }: { photos: Photo[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  function updateEdges() {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [photos.length]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrow = (enabled: boolean) =>
    "grid h-10 w-10 place-items-center rounded-full border bg-tile transition-all duration-200 " +
    (enabled
      ? "cursor-pointer border-accent/45 text-accent hover:shadow-[0_0_0_1px_rgba(205,181,132,.55),0_0_22px_rgba(205,181,132,.35)]"
      : "cursor-default border-line text-disabled");

  return (
    <section id="photos" className={`${panel} mt-4 scroll-mt-28 px-5 pb-6 pt-[22px] min-[720px]:px-[30px] min-[720px]:pb-[30px] min-[720px]:pt-7`}>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="text-[18px] font-medium tracking-[-0.3px] text-ink">Your chamber</h2>
        {photos.length > 1 && (
          <div className="flex flex-none items-center gap-2">
            <button type="button" aria-label="Previous photos" disabled={atStart} onClick={() => scrollByPage(-1)} className={arrow(!atStart)}>
              <Icon name="chevronLeft" size={16} strokeWidth={1.8} />
            </button>
            <button type="button" aria-label="Next photos" disabled={atEnd} onClick={() => scrollByPage(1)} className={arrow(!atEnd)}>
              <Icon name="chevronRight" size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
      <p className="mb-5 max-w-[62ch] text-pretty text-[13.5px] font-light leading-[1.6] text-body">
        Photos of your chamber as it moves from the production floor to your space. We add new ones at each milestone.
      </p>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={updateEdges}
          className="-mx-0.5 -my-1 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth px-0.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo) => (
            <a
              key={photo.src}
              href={photo.src}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-[4/3] w-[78%] flex-none snap-start overflow-hidden rounded-[14px] border border-line bg-[radial-gradient(ellipse_at_50%_40%,#1a2130,#0d1119_75%)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_0_28px_rgba(205,181,132,0.25)] min-[720px]:w-[300px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic same-origin proxy URL, not a static asset */}
              <img src={photo.src} alt={photo.alt} loading="lazy" onLoad={updateEdges} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
        <div
          aria-hidden="true"
          className={
            "pointer-events-none absolute -right-0.5 bottom-0 top-0 w-16 bg-gradient-to-r from-transparent to-[rgba(13,17,25,0.9)] transition-opacity duration-200 " +
            (atEnd ? "opacity-0" : "opacity-100")
          }
        />
      </div>
      {photos.length > 1 && (
        <div className="flex items-center gap-2 pt-3.5 text-[11.5px] font-medium tracking-[0.3px] text-muted">
          <span>Swipe or use the arrows to see all {photos.length} photos</span>
          <Icon name="arrowRight" size={14} strokeWidth={1.8} className="text-accent" />
        </div>
      )}
    </section>
  );
}
