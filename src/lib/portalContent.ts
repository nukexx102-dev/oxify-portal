// Customer-facing content for the Oxify portal — journey steps, milestone
// tooltips, per-status copy, product catalog, contact details. Kept in one
// file so wording changes don't require touching any logic. Safe to import
// from both server and client code (no secrets here).

export const CONTACT = {
  email: "support@oxify.com",
  phoneDisplay: "(888) 844-9249",
  phoneTel: "+18888449249",
  hours: "Mon–Sun, 9AM–5PM EST",
  tagline: "Recovery, Refined.",
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
    heroSub: "Your chamber is delivered, installed, and ready for you.",
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

// Keyed by the ClickUp "Chamber Model" dropdown value. `about` is a short
// description condensed from the model's oxify.com product page, shown in
// the "Your hyperbaric chamber" showcase. Models not listed here (e.g. Macy
// Pan models sold through Oxify) still show their name, just without the
// "Oxify" prefix, spec line or description.
export const PRODUCTS: Record<string, { name: string; spec: string; about: string }> = {
  "Nova Duo": {
    name: "Oxify Nova Duo",
    spec: "Hard shell · 2.0 ATA · Sitting · 1–2 people",
    about: "A hard shell chamber built for two — slimmer than comparable two-person chambers, with an 87″ × 44″ interior, wide sliding glass doors and dual touchscreens inside and out.",
  },
  "Nova Duo Pro": {
    name: "Oxify Nova Duo Pro",
    spec: "Hard shell · 2.0 ATA · Sitting · 1–5 people",
    about: "A hard shell chamber built for groups of up to five, with a spacious 82″ × 63″ interior, wide sliding doors and dual LCD screens inside and out.",
  },
  "Nova Quad": {
    name: "Oxify Nova Quad",
    spec: "Hard shell · 2.0 ATA · Sitting · 1–5 people",
    about: "Oxify's highest-capacity hard shell chamber, built for five or more users at once in high-volume wellness, sports and medical settings.",
  },
  Club: {
    name: "Oxify Club",
    spec: "Hard shell · 2.0 ATA · Walk-in cabin · Up to 4 people",
    about: "A first-class, seated walk-in cabin for up to four — clinical-grade oxygen at up to 2.0 ATA, in an interior made to relax, work or unwind in.",
  },
  Forge: {
    name: "Oxify Forge",
    spec: "Hard shell · 2.0 ATA · Sitting · 1 person",
    about: "A premium hard shell chamber in stainless steel and brushed aluminum, with a reclining chair and large high-clarity windows for a bright, open session.",
  },
  "Luma Pro": {
    name: "Oxify Luma Pro",
    spec: "Hard shell · 2.0 ATA · Lying · 1 person",
    about: "A bright, open hard shell chamber with room for an adult and a child, three large viewing windows, soft bedding and LCD panels inside and out.",
  },
  "Luma Standard": {
    name: "Oxify Luma Standard",
    spec: "Hard shell · 2.0 ATA · Lying · 1 person",
    about: "A lie-down hard shell chamber in stainless steel and polycarbonate, with an automatic pressure-sealing door and an electric lift bed for easy entry.",
  },
  "Flow Extended": {
    name: "Oxify Flow Extended",
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "An upright soft shell chamber built for two, with a spacious 88″ interior and three large viewing windows for a bright, shareable session.",
  },
  Flow: {
    name: "Oxify Flow",
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "A compact, quiet seated soft shell chamber — just 67″ long — that fits smaller rooms, with a dual-zipper entry that makes every session effortless.",
  },
  Sit: {
    name: "Oxify Sit",
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "A seated soft shell chamber designed around easy access, with an L-shaped zippered entrance, a generous 63″ interior height and three windows.",
  },
  "Sit Plus": {
    name: "Oxify Sit Plus",
    spec: "Soft shell · 1.4 ATA · Wheelchair accessible · 1 person",
    about: "Oxify's wheelchair-accessible chamber, with a wide 32″ × 52″ entry door and a roomy 5′3″ interior — simply roll in and go.",
  },
  Rest: {
    name: "Oxify Rest",
    spec: "Soft shell · 1.5 ATA · Lying · 1 person",
    about: "A roomy lie-down soft shell chamber, 88″ long with seven windows, designed for full-body comfort at home or in a clinic.",
  },
};

// Same document for every customer. Empty = "Coming soon" card.
// TODO: Oxify's own HBOT Safety Checklist and Digital Protocol Book links
// (owner will supply them — don't reuse Morelli's).
export const SHARED_DOCS = {
  safetyChecklist: "",
  protocolBook: "",
};
