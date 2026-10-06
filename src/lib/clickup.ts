// Server-only ClickUp access. Never import this from a "use client" file —
// CLICKUP_API_TOKEN must never reach the browser.
//
// Reads the Oxify space's "OXFY ORDER STATUS CRM" list. Custom fields are
// matched by NAME (case-insensitive, emoji included), so renaming a field in
// ClickUp without updating ORDER_FIELDS makes that value silently disappear
// from the portal — and for Order Number / Customer Email, makes every
// lookup 404. Treat these names as a contract with ops.

import { libraryRows } from "@/lib/chamberPhotos";
import {
  deliveryFor,
  EXCEPTION_STATUSES,
  INSTALL_REMOTE_COPY,
  JOURNEY,
  PRE_PRODUCTION_STATUSES,
  STATUS_COPY,
  type StatusCopy,
} from "@/lib/portalContent";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

const ORDERS_LIST_ID = process.env.CLICKUP_ORDERS_LIST_ID ?? "";
// Optional — when unset, all customer-facing copy comes from STATUS_COPY.
const STATUS_COPY_LIST_ID = process.env.CLICKUP_STATUS_COPY_LIST_ID ?? "";

const ORDER_FIELDS = {
  orderNumber: "Order Number", // short text — Shopify order name, e.g. "OXFY1020"
  customerEmail: "Customer Email", // email
  firstName: "First Name", // short text
  chamberModel: "Chamber Model", // dropdown — e.g. "Nova Duo Pro"
  brand: "Brand", // dropdown — e.g. "Oxify"; shown before the model name
  deliveryMethod: "Delivery Method", // dropdown — Premium White Glove / Standard White Glove / Standard Curbside Delivery
  configuration: "🔧 Configuration", // labels — ATA + add-ons
  trackingLink: "Tracking Link", // text
  etaUs: "🇺🇸 Estimated Arrival Date in US", // date
  etaDoor: "ETA to Door", // date
  deliveryWindow: "Delivery Window", // short text, freeform ops-typed text
  packageCount: "📦 Package Count", // number
  serialNumber: "Product SN", // short text
  userManual: "📖 User Manual", // url
  electricalRequirements: "🔌 Electrical Requirements/Spec Sheet", // url
  delayAlert: "Delay Alert", // checkbox — manual ops-set delay flag
  delayReason: "🐢 Delay Reason", // dropdown
  paymentTerms: "💰 Payment Terms", // dropdown: Fully Paid / Initial Deposit / Split Payments
  remainingBalance: "💰 Remaining Balance", // number
  remainingBalanceLink: "💰 Link - Remaining Balance", // url — "Pay Now" target
  orderPhotos: "Order Photos", // files — the "Your chamber" gallery
  modelPhoto: "🖼️ HBOT Photo (Model)", // url — per-order photo; overrides the library (custom colors)
  chamberColor: "Chamber Color", // dropdown — exterior color, filled by Zapier from Shopify
} as const;

// Same shape as Morelli's "Portal Status Copy" list, so an Oxify copy of it
// works unchanged. Only read when CLICKUP_STATUS_COPY_LIST_ID is set.
const COPY_FIELDS = {
  internalStatus: "Internal CRM Status", // comma-separated statuses the row covers
  heroHeadline: "Hero Headline",
  heroSub: "Hero Supporting Sentence",
  whatHappensNext: "What Happens Next Body",
} as const;

type RawCustomField = {
  id: string;
  name?: string;
  value?: unknown;
  type_config?: {
    options?: Array<{ id: string; name?: string; label?: string; orderindex: number }>;
  };
};

type RawAssignee = {
  id: number;
  username?: string;
  initials?: string;
  // A public, unauthenticated URL (attachments.clickup.com) — doesn't need
  // a proxy, unlike Order Photos files (see getOrderPhoto()/photo route).
  profilePicture?: string | null;
};

type RawTask = {
  id: string;
  name: string;
  list?: { id?: string };
  status?: { status?: string };
  custom_fields?: RawCustomField[];
  assignees?: RawAssignee[];
};

// One file in a ClickUp "files" custom field's value array.
type RawAttachment = {
  id: string;
  title?: string;
  extension?: string;
  mimetype?: string;
  url?: string;
  url_w_host?: string;
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp"]);

function isImageAttachment(a: RawAttachment): boolean {
  if (a.mimetype?.startsWith("image/")) return true;
  const ext = a.extension?.toLowerCase().replace(/^\./, "");
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

function orderPhotoFiles(fields: RawCustomField[] | undefined): RawAttachment[] {
  const v = field(fields, ORDER_FIELDS.orderPhotos)?.value;
  return Array.isArray(v) ? (v as RawAttachment[]).filter((a) => a?.id && isImageAttachment(a)) : [];
}

// Order photos come from the task's "Order Photos" files field — ops drops
// images into it as the chamber moves through production and delivery.
// Only file IDs go to the browser, never ClickUp file URLs: those can be
// short-lived, so /api/orders/photo looks up a fresh one (getOrderPhoto)
// at the moment the browser actually requests the image. The single-task
// endpoint is used because it always returns the field's full file list.
async function fetchPhotos(taskId: string): Promise<{ id: string; title: string }[]> {
  try {
    const detail = await clickupGet<RawTask>(`/task/${taskId}`);
    return orderPhotoFiles(detail.custom_fields).map((a) => ({ id: a.id, title: a.title ?? "Order photo" }));
  } catch {
    return []; // photos are a bonus — never let this break the lookup
  }
}

/**
 * A fresh download URL for one Order Photos file. Returns null unless the
 * task is on the Oxify orders list and the file is in its Order Photos
 * field, so the photo route can't be used to read other ClickUp files.
 */
export async function getOrderPhoto(
  taskId: string,
  fileId: string
): Promise<{ url: string; mimetype: string | null } | null> {
  if (!ORDERS_LIST_ID) return null;
  const task = await clickupGet<RawTask>(`/task/${encodeURIComponent(taskId)}`);
  if (task.list?.id !== ORDERS_LIST_ID) return null;
  const file = orderPhotoFiles(task.custom_fields).find((a) => a.id === fileId);
  const url = file?.url ?? file?.url_w_host;
  return url ? { url, mimetype: file?.mimetype ?? null } : null;
}

// The "HBot Photo (model)" field holds a Google Drive share link, which
// points at Drive's viewer page rather than the image itself. This turns it
// into URLs that return the image bytes — Drive's thumbnail endpoint first
// (fast, sized for the web), then the raw download as a fallback. A non-Drive
// https link is used as-is. The file must be shared "Anyone with the link".
function modelPhotoSource(link: string): string[] | null {
  const v = link.trim();
  if (!/^https:\/\//i.test(v)) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/i.test(url.hostname)) {
    const id = url.pathname.match(/\/d\/([\w-]{10,})/)?.[1] ?? url.searchParams.get("id");
    if (!id || !/^[\w-]{10,}$/.test(id)) return null;
    return [
      `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
      `https://drive.google.com/uc?export=download&id=${id}`,
    ];
  }
  return [url.toString()];
}

// Loose matching for model and color names, so "Oxify Original (Black)",
// "oxify original", "Aqua Marine"/"Aquamarine" and "Oxify Nova Duo Pro"/
// "Nova Duo Pro" all line up. Note "Nova Duo" ≠ "Nova Duo Pro".
function normalizeChoice(v: string): string {
  return v.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
}
function normalizeModel(v: string): string {
  return normalizeChoice(v).replace(/^oxify(?=.)/, "");
}

/**
 * The photo link to show for an order: its own "🖼️ HBOT Photo (Model)" link
 * if set (custom colors), otherwise the photo-library sheet's row for its
 * model + color (see chamberPhotos.ts),
 * otherwise "". Never a photo of a different color.
 */
async function resolveModelPhotoLink(fields: RawCustomField[] | undefined): Promise<string> {
  const own = textValue(fields, ORDER_FIELDS.modelPhoto);
  if (modelPhotoSource(own)) return own;

  const model = normalizeModel(choiceOrText(fields, ORDER_FIELDS.chamberModel));
  const color = normalizeChoice(choiceOrText(fields, ORDER_FIELDS.chamberColor));
  if (!model || !color) return "";
  try {
    const row = (await libraryRows()).find(
      (r) => normalizeModel(r.model) === model && normalizeChoice(r.color) === color && modelPhotoSource(r.photo)
    );
    return row?.photo ?? "";
  } catch (err) {
    console.error("[chamber photos] library unavailable", err);
    return ""; // the photo is a bonus — never let this break the lookup
  }
}

/**
 * Image-byte URLs for an order's model photo, or null. Only resolves the
 * link for a task in the Oxify orders list (its own link or its library
 * match), so the model-photo route can't be used to fetch arbitrary URLs.
 */
export async function getModelPhotoSources(taskId: string): Promise<string[] | null> {
  if (!ORDERS_LIST_ID) return null;
  const task = await clickupGet<RawTask>(`/task/${encodeURIComponent(taskId)}`);
  if (task.list?.id !== ORDERS_LIST_ID) return null;
  return modelPhotoSource(await resolveModelPhotoLink(task.custom_fields));
}

// Ignores emoji, capitals and extra spaces, so "🖼️ HBOT Photo (Model)",
// "HBot Photo (model)" and "📖 User Manual" / "User Manual" all match —
// ops can add, drop or swap a field's emoji without breaking the portal.
function normalizeFieldName(v: string): string {
  return v
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}️‍]/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sameName(a: string | undefined, b: string): boolean {
  return normalizeFieldName(a ?? "") === normalizeFieldName(b);
}

function field(fields: RawCustomField[] | undefined, name: string) {
  return fields?.find((f) => sameName(f.name, name));
}

function textValue(fields: RawCustomField[] | undefined, name: string): string {
  const v = field(fields, name)?.value;
  return v == null ? "" : String(v).trim();
}

// A dropdown's option name, or the field's text when it's a text field.
function choiceOrText(fields: RawCustomField[] | undefined, name: string): string {
  return typeof field(fields, name)?.value === "number" ? dropdownValue(fields, name) : textValue(fields, name);
}

function dropdownValue(fields: RawCustomField[] | undefined, name: string): string {
  const f = field(fields, name);
  const idx = f?.value;
  if (typeof idx !== "number") return "";
  const opt = f?.type_config?.options?.find((o) => o.orderindex === idx);
  return (opt?.name ?? opt?.label ?? "").trim();
}

function labelsValue(fields: RawCustomField[] | undefined, name: string): string[] {
  const f = field(fields, name);
  if (!Array.isArray(f?.value)) return [];
  const options = f?.type_config?.options ?? [];
  return (f.value as string[])
    .map((optId) => options.find((o) => o.id === optId)?.label?.trim())
    .filter((v): v is string => Boolean(v));
}

function dateValue(fields: RawCustomField[] | undefined, name: string): string | null {
  const raw = field(fields, name)?.value;
  if (!raw) return null;
  const ms = Number(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

// ClickUp checkboxes have no "value" key at all when unchecked, and
// value: "true" (a string, not a boolean) when checked.
function boolValue(fields: RawCustomField[] | undefined, name: string): boolean {
  const v = field(fields, name)?.value;
  return v === true || v === "true";
}

function numberValue(fields: RawCustomField[] | undefined, name: string): number | null {
  const v = field(fields, name)?.value;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

async function clickupGet<T>(path: string): Promise<T> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    throw new Error(
      "CLICKUP_API_TOKEN is not set. Add it to .env.local for local dev, or your Vercel project's Environment Variables for production."
    );
  }
  const res = await fetch(`${CLICKUP_API_BASE}${path}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ClickUp API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Order numbers are Shopify order names stored as-is (e.g. "OXFY1020", or
// "#OXFY1020"). Compare with "#", spaces and case stripped, so a customer
// typing "oxfy1020" or "#OXFY1020" on a phone still matches.
function normalizeOrderNumber(v: string): string {
  return v.replace(/[#\s]/g, "").toUpperCase();
}

// What a customer might type for the same order: the full name, or just the
// number off their confirmation email ("1020" → "OXFY1020").
function orderNumberCandidates(input: string): string[] {
  const n = normalizeOrderNumber(input);
  const forms = [n, `#${n}`];
  if (/^\d+$/.test(n)) forms.push(`OXFY${n}`, `#OXFY${n}`);
  return forms;
}

function orderNumbersMatch(stored: string, input: string): boolean {
  const s = normalizeOrderNumber(stored);
  const i = normalizeOrderNumber(input);
  return s === i || (/^\d+$/.test(i) && s.replace(/^[A-Z]+/, "") === i);
}

// Ops task names carry internal prefixes/suffixes — "MP- Scott Tooley
// (OXIFY) Nova Duo Pro", "INV345-Mark Sutor (OXIFY)", "Mike Blore - Oxify".
// Newer Zapier-created tasks are just the customer's name, which passes
// through unchanged.
function customerNameFrom(taskName: string): string {
  const cleaned = taskName
    .replace(/^\s*(MP|INV\s*\d+)\s*-\s*/i, "")
    .replace(/\s*\(.*$/, "")
    .replace(/\s*-\s*oxify\s*$/i, "")
    .trim();
  return cleaned || taskName.trim();
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OX";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type OrderDetails = {
  taskId: string;
  customerName: string;
  orderNumber: string;
  status: string; // raw internal status, lowercase
  chamberModel: string; // raw CRM dropdown value, e.g. "Nova Duo Pro"
  brand: string; // raw CRM dropdown value, e.g. "Oxify"
  deliveryMethod: string; // raw CRM dropdown value; see deliveryFor()
  configuration: string[];
  trackingLink: string | null;
  etaUs: string | null;
  etaDoor: string | null;
  deliveryWindow: string | null;
  packageCount: number | null;
  serialNumber: string | null;
  userManualUrl: string | null;
  electricalRequirementsUrl: string | null;
  coordinatorName: string | null;
  coordinatorInitials: string | null;
  coordinatorPhotoUrl: string | null;
  delayAlert: boolean;
  delayReason: string | null;
  paymentTerms: string | null;
  remainingBalance: number | null;
  remainingBalanceLink: string | null;
  photos: { id: string; title: string }[];
  hasModelPhoto: boolean; // served by /api/orders/model-photo
  chamberColor: string | null; // exterior color, e.g. "Tuxedo"
};

async function orderNumberFieldId(listId: string): Promise<string> {
  const data = await clickupGet<{ fields?: RawCustomField[] }>(`/list/${listId}/field`);
  const f = field(data.fields, ORDER_FIELDS.orderNumber);
  if (!f) throw new Error(`No "${ORDER_FIELDS.orderNumber}" custom field on ClickUp list ${listId}.`);
  return f.id;
}

async function findTaskByOrderNumber(listId: string, orderNumber: string, email: string): Promise<RawTask | null> {
  const fieldId = await orderNumberFieldId(listId);
  const normalizedEmail = email.trim().toLowerCase();

  for (const candidate of orderNumberCandidates(orderNumber)) {
    const filter = encodeURIComponent(JSON.stringify([{ field_id: fieldId, operator: "=", value: candidate }]));
    const data = await clickupGet<{ tasks?: RawTask[] }>(
      `/list/${listId}/task?include_closed=true&custom_fields=${filter}`
    );
    const match = (data.tasks ?? []).find(
      (t) =>
        orderNumbersMatch(textValue(t.custom_fields, ORDER_FIELDS.orderNumber), orderNumber) &&
        textValue(t.custom_fields, ORDER_FIELDS.customerEmail).toLowerCase() === normalizedEmail
    );
    if (match) return match;
  }
  return null;
}

export async function lookupOrder(orderNumber: string, email: string): Promise<OrderDetails | null> {
  if (!ORDERS_LIST_ID) {
    throw new Error("CLICKUP_ORDERS_LIST_ID is not set. Add it to .env.local (see .env.local.example).");
  }
  const task = await findTaskByOrderNumber(ORDERS_LIST_ID, orderNumber, email);
  if (!task) return null;

  const fields = task.custom_fields;
  // Native Assignee field — first assignee wins if ops adds more than one.
  const assignee = task.assignees?.[0];
  const coordinatorName = assignee?.username?.trim() || null;
  const deliveryWindow = textValue(fields, ORDER_FIELDS.deliveryWindow);

  return {
    taskId: task.id,
    customerName: customerNameFrom(task.name),
    orderNumber: textValue(fields, ORDER_FIELDS.orderNumber) || normalizeOrderNumber(orderNumber),
    status: (task.status?.status ?? "").toLowerCase(),
    chamberModel: dropdownValue(fields, ORDER_FIELDS.chamberModel),
    brand: dropdownValue(fields, ORDER_FIELDS.brand),
    deliveryMethod: dropdownValue(fields, ORDER_FIELDS.deliveryMethod),
    configuration: labelsValue(fields, ORDER_FIELDS.configuration),
    trackingLink: textValue(fields, ORDER_FIELDS.trackingLink) || null,
    etaUs: dateValue(fields, ORDER_FIELDS.etaUs),
    etaDoor: dateValue(fields, ORDER_FIELDS.etaDoor),
    // Freeform text ops types by hand — text with no digit at all is a typo,
    // not a window, so it reads as "TBD" rather than showing garbage.
    deliveryWindow: /\d/.test(deliveryWindow) ? deliveryWindow : null,
    packageCount: numberValue(fields, ORDER_FIELDS.packageCount),
    serialNumber: textValue(fields, ORDER_FIELDS.serialNumber) || null,
    userManualUrl: textValue(fields, ORDER_FIELDS.userManual) || null,
    electricalRequirementsUrl: textValue(fields, ORDER_FIELDS.electricalRequirements) || null,
    coordinatorName,
    coordinatorInitials: assignee ? assignee.initials?.trim() || initialsFrom(coordinatorName ?? "") : null,
    coordinatorPhotoUrl: assignee?.profilePicture || null,
    delayAlert: boolValue(fields, ORDER_FIELDS.delayAlert),
    delayReason: dropdownValue(fields, ORDER_FIELDS.delayReason) || null,
    paymentTerms: dropdownValue(fields, ORDER_FIELDS.paymentTerms) || null,
    remainingBalance: numberValue(fields, ORDER_FIELDS.remainingBalance),
    remainingBalanceLink: textValue(fields, ORDER_FIELDS.remainingBalanceLink) || null,
    photos: await fetchPhotos(task.id),
    hasModelPhoto: Boolean(modelPhotoSource(await resolveModelPhotoLink(fields))),
    chamberColor: choiceOrText(fields, ORDER_FIELDS.chamberColor) || null,
  };
}

export type DashboardData = {
  order: OrderDetails;
  copy: StatusCopy;
  kind: "journey" | "exception";
  currentStepIndex: number; // -1 = not started yet; index into JOURNEY
};

const FALLBACK_COPY: StatusCopy = {
  heroHeadline: "Here's where your order stands",
  heroSub: "Our team has the latest details on your order.",
  whatHappensNext: "Reach out using the details below and we'll fill you in on exactly where things are.",
};

/** Copy for this order's status: a ClickUp row if one matches, else the built-in default. */
async function getStatusCopy(order: OrderDetails): Promise<StatusCopy> {
  const builtIn =
    order.status === "installation scheduling" && !deliveryFor(order.deliveryMethod).onSiteInstall
      ? INSTALL_REMOTE_COPY
      : (STATUS_COPY[order.status] ?? FALLBACK_COPY);
  if (!STATUS_COPY_LIST_ID) return builtIn;

  try {
    const data = await clickupGet<{ tasks?: RawTask[] }>(`/list/${STATUS_COPY_LIST_ID}/task?include_closed=true`);
    const row = (data.tasks ?? []).find((t) =>
      textValue(t.custom_fields, COPY_FIELDS.internalStatus)
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(order.status)
    );
    if (!row) return builtIn;
    return {
      heroHeadline: textValue(row.custom_fields, COPY_FIELDS.heroHeadline) || builtIn.heroHeadline,
      heroSub: textValue(row.custom_fields, COPY_FIELDS.heroSub) || builtIn.heroSub,
      whatHappensNext: textValue(row.custom_fields, COPY_FIELDS.whatHappensNext) || builtIn.whatHappensNext,
    };
  } catch (err) {
    console.error("[status copy] falling back to built-in copy", err);
    return builtIn;
  }
}

export async function getDashboardData(order: OrderDetails): Promise<DashboardData> {
  const copy = await getStatusCopy(order);
  const kind = EXCEPTION_STATUSES.has(order.status) ? "exception" : "journey";
  const currentStepIndex = PRE_PRODUCTION_STATUSES.has(order.status)
    ? -1
    : JOURNEY.findIndex((s) => s.status === order.status);
  return { order, copy, kind, currentStepIndex };
}
