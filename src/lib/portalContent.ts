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

// How the chamber is delivered and set up. Per Oxify's policy:
// - Soft chambers always ship by DHL or FedEx, and once every package has
//   arrived a technician visits to install it — whatever the CRM's Delivery
//   Method field says.
// - Hard chambers follow the order's "Delivery Method" field. Premium White
//   Glove includes on-site installation and live training by a technician;
//   Standard White Glove (the default when the field is empty) is delivery
//   and placement, with setup and training done remotely by phone or video.
// `phrase` fills "{delivery}" in STATUS_COPY.
export type Delivery = {
  kind: "soft" | "premium" | "standard" | "curbside";
  label: string;
  phrase: string;
  note: string;
  onSiteInstall: boolean;
};

// Soft vs hard comes from the CRM's "Chamber Type" field; when that's blank,
// from the model's spec line (Flow, Sit, Rest… are soft shell).
export function isSoftChamber(chamberType: string, model: string): boolean {
  if (/soft/i.test(chamberType)) return true;
  if (/hard/i.test(chamberType)) return false;
  return Boolean(PRODUCTS[model]?.spec.startsWith("Soft"));
}

export function deliveryFor(method: string, softChamber = false): Delivery {
  if (softChamber) {
    return {
      kind: "soft",
      label: "DHL / FedEx",
      phrase: "DHL / FedEx delivery",
      note: "Your chamber ships to you by DHL or FedEx. Once every package has arrived, a technician will visit to install it.",
      onSiteInstall: true,
    };
  }
  if (/premium/i.test(method)) {
    return {
      kind: "premium",
      label: "Premium White Glove",
      phrase: "Premium White Glove delivery",
      note: "White-glove delivery to your approved location, plus on-site installation and live training by a certified technician.",
      onSiteInstall: true,
    };
  }
  if (/curbside/i.test(method)) {
    return {
      kind: "curbside",
      label: "Curbside Delivery",
      phrase: "curbside delivery",
      note: "Delivered to your curb. Setup support and training are provided remotely by phone or video.",
      onSiteInstall: false,
    };
  }
  return {
    kind: "standard",
    label: "Standard White Glove",
    phrase: "Standard White Glove delivery",
    note: "Offloading, uncrating, packaging removal and placement at your approved location. Setup support and training are provided remotely by phone or video.",
    onSiteInstall: false,
  };
}

// The customer journey, in order. `status` MUST exactly match (lowercase) a
// native ClickUp status on the OXFY ORDER STATUS CRM list. `tip` is the
// milestone hover description — owner-approved (Oct 2026); change only on
// request. `tip` covers hard chambers (Premium for Setup & Training);
// `tipSoft` / `tipRemote` replace it for soft chambers / hard chambers
// without on-site installation — see stepTip(). Production and shipping
// wording follows Morelli's portal, which shows customers no lead times.
export const JOURNEY = [
  {
    status: "in production",
    label: "In Production",
    icon: "production",
    tip: "Your chamber is on the production line. The shell is produced, then the machinery and all electrical components are assembled. After that it goes through testing, sometimes extra testing to make sure it arrives 100% working.",
  },
  {
    status: "ready to ship",
    label: "Ready to Ship",
    icon: "box",
    tip: "Production is complete. Your chamber is being packed and prepared for shipment.",
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
    tip: "Once your chamber arrives in the U.S., it's sorted and goes through customs inspection. Please know that this step is outside our control.",
  },
  {
    status: "delivery scheduled",
    label: "Delivery Scheduled",
    icon: "calendar",
    tip: "After customs clearance, your chamber will be sent to our white glove team and they will finalize your delivery: date, arrival window and access details.",
    tipSoft: "Your chamber ships to you by DHL or FedEx. You'll receive tracking details so you can follow each package to your door.",
  },
  {
    status: "installation scheduling",
    label: "Setup & Training",
    icon: "technician",
    tip: "We will schedule a certified technician to visit you and install your chamber and give you hands-on training.",
    tipRemote: "We will schedule a remote call for you with our technician to walk you through the connections, basic setup and how to operate your chamber.",
    tipSoft: "Once all your packages have arrived, we'll schedule a technician to install your chamber for you.",
  },
  {
    status: "delivered",
    label: "Delivered",
    icon: "home",
    tip: "Your chamber is delivered and set up, you're ready to begin your sessions.",
  },
] as const;

export type JourneyStep = (typeof JOURNEY)[number];

/** The hover description for a step, matching how this order is delivered and set up. */
export function stepTip(step: JourneyStep, delivery: Delivery): string {
  if (delivery.kind === "soft" && "tipSoft" in step) return step.tipSoft;
  if (!delivery.onSiteInstall && "tipRemote" in step) return step.tipRemote;
  return step.tip;
}

// Columns for the expandable "View the full journey" list — every JOURNEY
// status should appear in exactly one phase.
export const JOURNEY_PHASES = [
  { title: "Production", statuses: ["in production", "ready to ship"] },
  { title: "Shipping & customs", statuses: ["in transit", "customs clearance"] },
  { title: "Delivery & setup", statuses: ["delivery scheduled", "installation scheduling", "delivered"] },
];

// Before production starts — the rail shows no current step yet. Both
// share the "order received" copy, as Morelli's Pre-Production row does.
export const PRE_PRODUCTION_STATUSES = new Set(["order received", "po sent/payment needed"]);
// Orders that ended another way — shown as a simple message, no rail.
export const EXCEPTION_STATUSES = new Set(["cancelled", "refunded"]);

export type StatusCopy = { heroHeadline: string; heroSub: string; whatHappensNext: string };

// Default copy per status. Headlines, the line under them and "What happens
// next" are the owner's approved tables (Oct 2026) — change them only on
// request. "{coord}"
// becomes the order specialist's first name and "{delivery}" the order's
// delivery type (deliveryFor().phrase). Soft chambers use SOFT_STATUS_COPY
// for the statuses where their DHL/FedEx + technician process differs;
// hard chambers without on-site installation use INSTALL_REMOTE_COPY for
// "installation scheduling".
const PRE_PRODUCTION_COPY: StatusCopy = {
  heroHeadline: "Your order has been received",
  heroSub: "Your order is in process.",
  whatHappensNext:
    "Your order is being confirmed by the factory as they finalize your configuration and get everything ready to begin production. This part usually moves quickly — once production begins, you'll see it reflected here automatically.",
};

// Installation Scheduling for orders without on-site installation.
export const INSTALL_REMOTE_COPY: StatusCopy = {
  heroHeadline: "Setup Scheduling",
  heroSub: "We're scheduling your phone or video session to help you get set up!",
  whatHappensNext:
    "Your chamber has been delivered. Next, our team will schedule a remote call with our technician to walk you through the equipment connections, basic setup and how to operate your chamber. Please let us know your availability for the remote call.",
};

// Soft chambers: shipped by DHL / FedEx, then always installed on-site by a
// technician. Owner-approved wording (Oct 2026); change only on request.
export const SOFT_STATUS_COPY: Record<string, StatusCopy> = {
  "delivery scheduled": {
    heroHeadline: "Your DHL / FedEx delivery is being scheduled",
    heroSub: "Your order is now being scheduled for delivery.",
    whatHappensNext:
      "Your chamber is on its way to you by DHL or FedEx and may arrive in several packages. You'll receive tracking details so you can follow each one to your door. Once everything has arrived, we'll schedule your technician's installation visit.",
  },
  "installation scheduling": {
    heroHeadline: "Technician Scheduling",
    heroSub: "We are currently finalizing the technician's schedule to guide you on your setup!",
    whatHappensNext:
      "All your packages have been delivered. Next, a technician will schedule a visit to install your chamber and walk you through how to use it, subject to technician availability, travel and site readiness. We will reach out to confirm the date and time.",
  },
};

export const STATUS_COPY: Record<string, StatusCopy> = {
  "order received": {
    ...PRE_PRODUCTION_COPY,
    heroSub: "We've just received your order — thank you for choosing Oxify. Our team will now begin to process your order!",
    whatHappensNext:
      "Our team is reviewing your order and confirming your configuration. Once everything is set, we'll send it to the factory, and you'll see each step update here automatically.",
  },
  "po sent/payment needed": {
    ...PRE_PRODUCTION_COPY,
    heroSub: "Our team is finalizing your order details and processing your order with the factory.",
    whatHappensNext:
      "We're finalizing your order with the factory to make sure we haven't missed anything. Once everything is finalized, your order will be lined up for production.",
  },
  "in production": {
    heroHeadline: "Your chamber is in production",
    heroSub: "Your chamber is now on the production line, where it will be built, assembled and tested.",
    whatHappensNext:
      "Your chamber is being built to your exact configuration, then assembled and tested, sometimes with extra testing to make sure it arrives 100% ready. Once it passes, it will be prepared for shipping.",
  },
  "ready to ship": {
    heroHeadline: "Your chamber is being prepared to ship",
    heroSub: "Your order is ready to ship! Our logistics team is now preparing the shipment details.",
    whatHappensNext:
      "Production has been completed! Your chamber is being prepared for shipment. You will receive tracking information once your chamber is loaded for shipment.",
  },
  "in transit": {
    heroHeadline: "Your chamber is in transit",
    heroSub: "Your order is on its way to you!",
    whatHappensNext:
      "Your chamber is on its way to the United States. Our team will keep you updated throughout the transit phase. Once it arrives at the port, it will be sorted first and then move into U.S. customs clearance.",
  },
  "customs clearance": {
    heroHeadline: "Your chamber has arrived in the U.S. and is clearing customs",
    heroSub: "Your order is now going through customs clearance.",
    whatHappensNext:
      "Your chamber has arrived in the U.S. and is being inspected by U.S. customs. This step is outside our control, but our freight team is monitoring it closely. Once it clears, your chamber will be sent to our warehouse partners. After that, our team will reach out to you to schedule delivery.",
  },
  "delivery scheduled": {
    heroHeadline: "Your {delivery} is being scheduled",
    heroSub: "Your order is now being scheduled for delivery.",
    whatHappensNext:
      "Your chamber is close by. We're finalizing your {delivery}: the date, arrival window and any access details for your space. Our team will keep in touch with you at this point.",
  },
  "installation scheduling": {
    heroHeadline: "Technician Scheduling",
    heroSub: "We are currently finalizing the technician's schedule to guide you on your setup!",
    whatHappensNext:
      "Your chamber has been delivered. After 2–3 days, a certified technician will schedule a visit to complete the installation and walk you through hands-on training, subject to technician availability, travel and site readiness. We will reach out to confirm the date and time.",
  },
  delivered: {
    heroHeadline: "You're all set!",
    heroSub: "Your order was delivered! Any questions or concerns, please let us know!",
    whatHappensNext:
      "Your chamber is installed and your training is complete. Your documents below are here whenever you need them, and we are just a message or call away. Enjoy your hyperbaric chamber!",
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

// Keyed by the ClickUp "Chamber Model" dropdown value. The chamber's display
// name isn't stored here: it's the order's Brand + Chamber Model straight
// from the CRM (e.g. "Oxify" + "Flow Extended"). `about` is the short
// description in the "Your hyperbaric chamber" showcase, in Oxify's voice
// ("Overcome anything. Achieve everything."). Keep it to how the chamber
// feels and who it's for — no materials, measurements, numbers or health
// claims (the spec line above it already covers the facts, and builds can
// differ from the website). Models not listed here (e.g. Macy Pan models
// sold through Oxify) still show their name, just without a spec line or
// description.
export const PRODUCTS: Record<string, { spec: string; about: string }> = {
  "Nova Duo": {
    spec: "Hard shell · 2.0 ATA · Sitting · 1–2 people",
    about: "Built for two. Share every session with the person who pushes you — or take the space to stretch out and reset on your own.",
  },
  "Nova Duo Pro": {
    spec: "Hard shell · 2.0 ATA · Sitting · 1–5 people",
    about: "Room for up to five, side by side. Bring your family, your team or your clients into every session — and rise together.",
  },
  "Nova Quad": {
    spec: "Hard shell · 2.0 ATA · Sitting · 5+ people",
    about: "Our largest seated chamber, built for teams that train hard and wellness spaces that never slow down.",
  },
  Club: {
    spec: "Hard shell · 2.0 ATA · Walk-in cabin · Up to 4 people",
    about: "A walk-in cabin for up to four. Step in, sit back, and make every session your time to reset, refocus and recharge.",
  },
  Forge: {
    spec: "Hard shell · 2.0 ATA · Sitting · 1 person",
    about: "Your own space to reset. A reclining seat and big, bright windows turn every session into time that's fully yours.",
  },
  "Luma Pro": {
    spec: "Hard shell · 2.0 ATA · Lying · 1–2 people",
    about: "Lie back in a bright, open chamber with room for an adult and a child — every session, a chance to reset together.",
  },
  "Luma Standard": {
    spec: "Hard shell · 2.0 ATA · Lying · 1 person",
    about: "Stretch out and switch off. An easy-entry bed makes every session simple — all that's left is to rest and reset.",
  },
  "Flow Extended": {
    spec: "Soft shell · 1.5 ATA · Sitting · 1–2 people",
    about: "Room for two, upright and open. Share the session or claim the space — either way, you step out ready for what's next.",
  },
  Flow: {
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "Compact enough for any room, ready whenever you are. Zip in, sit back, and make every session part of your routine.",
  },
  Sit: {
    spec: "Soft shell · 1.5 ATA · Sitting · 1 person",
    about: "Easy in, easy reset. Step in, settle into an upright seat, and give yourself the session you've earned.",
  },
  "Sit Plus": {
    spec: "Soft shell · 1.4 ATA · Wheelchair accessible · 1 person",
    about: "No barriers. A wide, wheelchair-accessible entry means you simply roll in and go — because everyone deserves to achieve everything.",
  },
  Rest: {
    spec: "Soft shell · 1.5 ATA · Lying · 1 person",
    about: "Stretch out from head to toe. A roomy lie-down chamber with plenty of windows, made for full-body rest at home or in a clinic.",
  },
};

// Same document for every customer. Empty = "Coming soon" card.
// TODO: Oxify's own Digital Protocol Book link (owner will supply it —
// don't reuse Morelli's).
export const SHARED_DOCS = {
  safetyChecklist: "https://drive.google.com/file/d/1eSwZnyTauM7wSO7PuIhEzkIdABRpKJpy/view?usp=sharing",
  protocolBook: "",
};
