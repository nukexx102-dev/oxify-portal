# Oxify Order Tracking Portal

Customers enter their **order number + email** and see their chamber's live
status, delivery dates, order specialist, photos, and documents. There's no
database and no password. Every lookup reads ClickUp directly, so edits in
ClickUp show up on the customer's next visit with no deploy.

This is a separate app from the Morelli Medical portal: its own repo, its
own Vercel project, and it reads only the Oxify space in ClickUp.

## Where the data comes from

ClickUp: **Oxify space › OXFY ORDER STATUS CRM** (filled by the Shopify →
Zapier integration). The journey follows that list's statuses:

```
order received / po sent/payment needed  (before production — no step lit yet)
→ in production → ready to ship → in transit → customs clearance
→ delivery scheduled → installation scheduling → delivered   (exceptions: cancelled, refunded)
```

Fields are matched **by name**, so renaming one in ClickUp hides it from
the portal. The names it reads are listed in `ORDER_FIELDS` in
`src/lib/clickup.ts`. `Order Number` and `Customer Email` are required for
a lookup. The others fill the page when set:

- `Chamber Model` → chamber name and spec line
- `Chamber Color` → shown in the showcase and Order Details, and used to
  pick the photo. The photo shown is, in order: the order's own
  `🖼️ HBOT Photo (Model)` link (use for custom colors), else the row for its
  model + color in the optional **Oxify Chamber Photos** Google Sheet
  (`CHAMBER_PHOTOS_SHEET_URL`; columns `Chamber Model`, `Chamber Color`,
  `Photo`; shared "Anyone with the link"), else no photo — never a different color. Photos are Google Drive
  links shared as "Anyone with the link can view".
- `🔧 Configuration` → configuration row. "Water Chiller AC" adds the
  "ships separately" note.
- `Delivery Method` → delivery wording and which setup path is shown
- `Tracking Link`, `Delivery Window`, `📦 Package Count`,
  `Product SN` → order details
- `🇺🇸 Estimated Arrival Date in US`, `ETA to Door` → the two date cards
- `📖 User Manual`, `🔌 Electrical Requirements/Spec Sheet` → documents
- `Delay Alert` + `🐢 Delay Reason` → amber "Delayed" pill and banner
- `💰 Payment Terms` = Initial Deposit + `💰 Remaining Balance` +
  `💰 Link - Remaining Balance` → "Complete your remaining balance" card,
  shown from Ready to Ship onward
- Task assignee → the order specialist card (name and ClickUp photo)
- `Order Photos` → the "Your chamber" gallery (images only; the section
  is hidden until the first photo is added)

Customers can type `OXFY1020`, `#oxfy1020` or just `1020`.

## Editing the wording

All customer-facing text lives in `src/lib/portalContent.ts`:

- the step labels and milestone tooltips
- the per-status headline, sub-line and "What happens next" text
- contact details, the product catalog, and the two shared document links

**Soft chambers** (CRM `Chamber Type`, or the model when blank) always ship by
DHL / FedEx and are then installed on-site by a technician (`SOFT_STATUS_COPY`).
For **hard chambers**, delivery follows the order's **Delivery Method** field (`deliveryFor()`):
Premium White Glove includes on-site installation and live training by a
technician; Standard White Glove (also the default when empty) is delivery
and placement, with setup and training remotely by phone or video. The
"installation scheduling" status shows the technician version (Premium) or
the remote-setup version (`INSTALL_REMOTE_COPY`) accordingly.

Optionally, set `CLICKUP_STATUS_COPY_LIST_ID` to an **Oxify-only** copy of
the "Portal Status Copy" list so staff can edit the headline and "What
happens next" text in ClickUp instead. Don't point it at Morelli's list:
the two brands share status names, so Morelli's wording would leak in.

## Local dev

```
cp .env.local.example .env.local   # then add your ClickUp token in your editor
npm install
npm run dev
```

## Deploy (new GitHub repo + new Vercel project)

1. Create a new **private** GitHub repo (e.g. `oxify-portal`) and push this
   folder to it. Don't push it to `morelli-portal`.
2. In Vercel, **Add New › Project**, import the new repo, and keep the
   default Next.js settings.
3. Add the environment variables from `.env.local.example`
   (`CLICKUP_API_TOKEN`, `CLICKUP_ORDERS_LIST_ID`) and deploy.
4. In the Vercel project's **Domains** settings, add `portal.oxify.com`,
   then add the DNS record Vercel shows you at Oxify's domain registrar.
