// Customer-facing content for the Oxify portal — journey steps, milestone
// tooltips, per-status copy, product catalog, contact details. Kept in one
// file so wording changes don't require touching any logic. Safe to import
// from both server and client code (no secrets here).

export const CONTACT = {
  email: "support@oxify.com",
  phoneDisplay: "(888) 844-9249",
  phoneTel: "+18888449249",
  hours: "Mon–Sun, 9AM–5PM EST",
  tagline: "Overcome anything. Achieve everything.",
  portalUrl: "portal.oxify.com",
};

// Every Oxify order — hard and soft chambers alike — ships Premium White
// Glove, so the portal shows this regardless of the CRM's Delivery Method
// field (which was copied over from Morelli's list).
export const DELIVERY = {
  label: "Premium White Glove",
  note: "Delivery into your space, full installation, and hands-on training — included with every Oxify chamber.",
};

// The customer journey, in order. `status` MUST exactly match (lowercase) a
// native ClickUp status on the OXFY ORDER STATUS CRM list. `tip` is the
// milestone tooltip. Wording and timing follow Morelli Medical's portal
// (its step descriptions and its Premium White Glove copy); Morelli shows
// customers no production or shipping lead times, so neither does this.
export const JOURNEY = [
  {
    status: "in production",
    label: "In Production",
    icon: "production",
    tip: "Your chamber is on the production line. The shell is produced, then the machinery and all electrical components are assembled. After that it goes through testing — sometimes a chamber needs additional testing to make sure it arrives 100% working.",
  },
  {
    status: "ready to ship",
    label: "Ready to Ship",
    icon: "box",
    tip: "Production is complete. The production team is packing your chamber and preparing it for shipment.",
  },
  {
    status: "in transit",
    label: "In Transit",
    icon: "anchor",
    tip: "Your chamber is on its way to the United States.",
  },
  {
    status: "customs clearance",
    label: "Clearing Customs",
    icon: "customs",
    tip: "Once your chamber arrives in the United States, it's sorted and goes through customs clearance — basically a U.S. inspection. We don't have control over the package once it reaches U.S. customs.",
  },
  {
    status: "delivery scheduled",
    label: "Premium White Glove Scheduled",
    icon: "calendar",
    tip: "The logistics team is booking a truck, arranging pickup of your chamber, and finalizing your Premium White Glove delivery appointment — date, arrival window, and access details.",
  },
  {
    status: "delivered",
    label: "Delivered & Installed",
    icon: "home",
    tip: "Hard chambers: our crew brings your chamber inside and places it, and a certified technician completes the full installation and hands-on training within about 2 days. Soft chambers: our crew confirms every package, then returns the next day to set it up, install it, and train you on site.",
  },
] as const;

// Columns for the expandable "View the full journey" list — every JOURNEY
// status should appear in exactly one phase.
export const JOURNEY_PHASES = [
  { title: "Production", statuses: ["in production", "ready to ship"] },
  { title: "Shipping & customs", statuses: ["in transit", "customs clearance"] },
  { title: "Premium White Glove delivery", statuses: ["delivery scheduled", "delivered"] },
];

// Before production starts — the rail shows no current step yet. Both
// share the "order received" copy, as Morelli's Pre-Production row does.
export const PRE_PRODUCTION_STATUSES = new Set(["order received", "po sent/payment needed"]);
// Orders that ended another way — shown as a simple message, no rail.
export const EXCEPTION_STATUSES = new Set(["cancelled", "refunded"]);

export type StatusCopy = { heroHeadline: string; heroSub: string; whatHappensNext: string };

// Default copy per status, adapted from Morelli's "Portal Status Copy" rows.
// If CLICKUP_STATUS_COPY_LIST_ID is set, a matching row in that ClickUp list
// overrides these (see getStatusCopy in clickup.ts). "{coord}" is replaced
// with the order specialist's first name.
const PRE_PRODUCTION_COPY: StatusCopy = {
  heroHeadline: "Your order has been received",
  heroSub: "Your order is in process.",
  whatHappensNext:
    "Your order is being confirmed by the factory as they finalize your configuration and get everything ready to begin production. This part usually moves quickly — once production begins, you'll see it reflected here automatically.",
};

export const STATUS_COPY: Record<string, StatusCopy> = {
  "order received": PRE_PRODUCTION_COPY,
  "po sent/payment needed": PRE_PRODUCTION_COPY,
  "in production": {
    heroHeadline: "Your chamber is in production",
    heroSub: "Our manufacturing team has started building your unit.",
    whatHappensNext:
      "Right now your chamber is being manufactured to your exact configuration. Once production wraps, it'll be prepared for shipping. We'll update this page automatically as it moves through each stage.",
  },
  "ready to ship": {
    heroHeadline: "Your chamber is being prepared to ship",
    heroSub: "Production is complete and your unit is being packed for its journey.",
    whatHappensNext:
      "Your chamber has finished production and is now being packed and prepared for shipping. Once it ships, you'll see its progress update here.",
  },
  "in transit": {
    heroHeadline: "Your chamber is in transit",
    heroSub: "It's on its way to the United States.",
    whatHappensNext:
      "Your chamber is currently in transit. Once it arrives in the U.S., it'll move into customs clearance. We'll update your status as soon as it lands.",
  },
  "customs clearance": {
    heroHeadline: "Your chamber has arrived in the U.S. and is clearing customs",
    heroSub: "It's currently being processed through U.S. customs.",
    whatHappensNext:
      "Your chamber has landed in the U.S. and is now going through customs clearance. This step is handled entirely by our freight and customs team. Once it clears, we'll move it toward your Premium White Glove delivery.",
  },
  "delivery scheduled": {
    heroHeadline: "Your Premium White Glove delivery is being scheduled",
    heroSub: "Our team is coordinating your delivery date and window.",
    whatHappensNext:
      "Your chamber is close by and we're finalizing your Premium White Glove delivery appointment — including date, arrival window, and any access details we need from you. {coord} will reach out directly to confirm.",
  },
  delivered: {
    heroHeadline: "You're all set!",
    heroSub: "Your chamber is installed and ready. Overcome anything. Achieve everything.",
    whatHappensNext:
      "Your chamber has been delivered and installed, and your training is complete. You're ready to begin using your chamber. If you have any questions along the way, {coord} is just a message or call away.",
  },
  cancelled: {
    heroHeadline: "This order has been cancelled",
    heroSub: "If this is unexpected, we're here to help.",
    whatHappensNext:
      "This order is no longer active. If you have any questions about it, contact our support team using the details below and we'll help right away.",
  },
  refunded: {
    heroHeadline: "This order has been refunded",
    heroSub: "Your refund has been processed.",
    whatHappensNext:
      "If you have any questions about your refund, contact our support team using the details below and we'll help right away.",
  },
};

// Keyed by the ClickUp "Chamber Model" dropdown value. Every Oxify soft
// chamber ships in its Pro (top) configuration — there's no standard
// version — so soft chamber names carry "Pro". `about` is the short
// description in the "Your hyperbaric chamber" showcase, in Oxify's voice
// ("Overcome anything. Achieve everything."). Keep it to how the chamber
// feels and who it's for — no materials, measurements, numbers or
// health claims (the spec line above it already covers the facts, and
// builds can differ from the website). Models not listed here (e.g. Macy Pan
// models sold through Oxify) still show their name, just without the
// "Oxify" prefix, spec line or description.
export const PRODUCTS: Record<string, { name: string; spec: string; about: string }> = {
  "Nova Duo": {
    name: "Oxify Nova Duo",
    spec: "Hard shell · 2.0 ATA · Sitting · 1–2 people",
    about: "Built for two. Share every session with the person who pushes you — or take the space to stretch out and reset on your own.",
  },
  "Nova Duo Pro": {
    name: "Oxify Nova Duo Pro",
    spec: "Hard shell · 2.0 ATA · Sitting · 1–5 people",
    about: "Room for up to five, side by side. Bring your family, your team or your clients into every session — and rise together.",
  },
  "Nova Quad": {
    name: "Oxify Nova Quad",
    spec: "Hard shell · 2.0 ATA · Sitting · 1–5 people",
    about: "Our largest seated chamber, built for teams that train hard and wellness spaces that never slow down.",
  },
  Club: {
    name: "Oxify Club",
    spec: "Hard shell · 2.0 ATA · Walk-in cabin · Up to 4 people",
    about: "A walk-in cabin for up to four. Step in, sit back, and make every session your time to reset, refocus and recharge.",
  },
  Forge: {
    name: "Oxify Forge",
    spec: "Hard shell · 2.0 ATA · Sitting · 1 person",
    about: "Your own space to reset. A reclining seat and big, bright windows turn every session into time that's fully yours.",
  },
  "Luma Pro": {
    name: "Oxify Luma Pro",
    spec: "Hard shell · 2.0 ATA · Lying · 1 person",
    about: "Lie back in a bright, open chamber with room for an adult and a child — every session, a chance to reset together.",
  },
  "Luma Standard": {
    name: "Oxify Luma Standard",
    spec: "Hard shell · 2.0 ATA · Lying · 1 person",
    about: "Stretch out and switch off. An easy-entry bed makes every session simple — all that's left is to rest and reset.",
  },
  "Flow Extended": {
    name: "Oxify Flow Extended Pro",
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "Room for two, upright and open. Share the session or claim the space — either way, you step out ready for what's next.",
  },
  Flow: {
    name: "Oxify Flow Pro",
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "Compact enough for any room, ready whenever you are. Zip in, sit back, and make every session part of your routine.",
  },
  Sit: {
    name: "Oxify Sit Pro",
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "Easy in, easy reset. Step in, settle into an upright seat, and give yourself the session you've earned.",
  },
  "Sit Plus": {
    name: "Oxify Sit Plus Pro",
    spec: "Soft shell · 1.4 ATA · Wheelchair accessible · 1 person",
    about: "No barriers. A wide, wheelchair-accessible entry means you simply roll in and go — because everyone deserves to achieve everything.",
  },
  Rest: {
    name: "Oxify Rest Pro",
    spec: "Soft shell · 1.5 ATA · Lying · 1 person",
    about: "Stretch out from head to toe. A roomy lie-down chamber with plenty of windows, made for full-body rest at home or in a clinic.",
  },
};

// Same document for every customer. Empty = "Coming soon" card.
// TODO: Oxify's own HBOT Safety Checklist and Digital Protocol Book links
// (owner will supply them — don't reuse Morelli's).
export const SHARED_DOCS = {
  safetyChecklist: "",
  protocolBook: "",
};
