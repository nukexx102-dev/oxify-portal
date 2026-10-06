// Server-only. The chamber photo library: a Google Sheet with one row per
// Chamber Model + Chamber Color and a Photo column (a Google Drive link).
// Ops edit it in Google Sheets; the portal reads it as CSV, so changes show
// up within about a minute — no ClickUp list, no deploy.
//
// CHAMBER_PHOTOS_SHEET_URL can be the sheet's normal share link (shared as
// "Anyone with the link can view") or a "Publish to web" CSV link. When it's
// unset, only an order's own HBOT Photo link is used.

const SHEET_URL = process.env.CHAMBER_PHOTOS_SHEET_URL ?? "";
const CACHE_MS = 60_000;

export type LibraryRow = { model: string; color: string; photo: string };

let cache: { at: number; rows: LibraryRow[] } | null = null;

// A normal Sheets link (…/spreadsheets/d/<id>/edit#gid=<tab>) becomes its CSV
// export URL; a "Publish to web" link (…/d/e/…/pub?output=csv) is used as-is.
function csvUrl(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.hostname !== "docs.google.com") return null;
  if (url.pathname.includes("/spreadsheets/d/e/")) return url.toString();
  const id = url.pathname.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return null;
  // No tab in the link → let Google export the first tab. (Don't assume
  // gid=0: sheets imported from .xlsx get random tab IDs, and an unknown
  // gid makes the export fail with HTTP 400.)
  const gid = url.hash.match(/gid=(\d+)/)?.[1] ?? url.searchParams.get("gid");
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

// Minimal RFC 4180 CSV parser — handles quoted cells, "" escapes, commas and
// line breaks inside quotes, which is all a Sheets CSV export uses.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const header = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");

export async function libraryRows(): Promise<LibraryRow[]> {
  if (!SHEET_URL) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;

  const url = csvUrl(SHEET_URL);
  if (!url) throw new Error("CHAMBER_PHOTOS_SHEET_URL isn't a Google Sheets link.");
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("csv")) {
    // A private sheet answers with a sign-in page, not CSV.
    throw new Error(`Chamber photo sheet unavailable (${res.status} ${type}) — is it shared "Anyone with the link"?`);
  }

  const [head = [], ...body] = parseCsv(await res.text());
  // Columns are found by their header, in any order: Chamber Model,
  // Chamber Color (or Colour), Photo.
  const col = (...names: string[]) => head.findIndex((h) => names.includes(header(h)));
  const m = col("chambermodel", "model");
  const c = col("chambercolor", "chambercolour", "color", "colour");
  const p = col("photo", "photolink", "photourl", "link");
  if (m < 0 || c < 0 || p < 0) {
    throw new Error("Chamber photo sheet needs Chamber Model, Chamber Color and Photo columns.");
  }

  const rows = body
    .map((r) => ({ model: (r[m] ?? "").trim(), color: (r[c] ?? "").trim(), photo: (r[p] ?? "").trim() }))
    .filter((r) => r.model && r.color && r.photo);
  cache = { at: Date.now(), rows };
  return rows;
}
