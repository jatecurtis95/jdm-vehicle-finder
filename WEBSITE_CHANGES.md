# Website Changes — JDM Vehicle Finder (admin CRM)

> Spec of record for this work session. Reconstructed from the client's
> "Website changes.docx" (screenshots + notes) after the originally-referenced
> `WEBSITE_CHANGES.md` was found to be absent from the repo. See
> `CHANGES_SUMMARY.md` for the discrepancy note and all decisions/assumptions.

## Rules for this session

1. Work autonomously; at any decision point pick the most sensible option
   consistent with the existing codebase and design system, and record it in
   `CHANGES_SUMMARY.md`.
2. After each section: run the build (`npm test` + `wrangler deploy --dry-run`),
   fix any errors, then commit.
3. Do **not** deploy, and do **not** push to `main`, under any circumstances.
4. Match the existing admin design system (dark theme, `shell()`/`brandShell()`,
   the `CSS`/per-view inline style blocks, existing helpers). No new frameworks.
5. Preserve the security fixes already shipped this session.
6. Keep the test suite green (currently 205 tests).

## Priority order & sections

1. **Dashboard** — layout is messy; boxes "all over the place"; a second set of
   KPI boxes lower down looks out of place. Restructure; remove/merge the
   duplicate KPI row; establish clear hierarchy.
2. **Requests page** — explain the green/red dots and the "REQ" badge; clarify
   "last activity"; show whether examples have been sent / emailed and whether
   the client viewed them; richer client side-panel (drawer) with more
   conversion-useful info (contact, engagement, match strength).
3. **Tasks page** — add a purpose/instructions explainer so staff know what it
   is and how to use it.
4. **Matches page** — bulk delete ("start fresh"); search/filter by client;
   closing-assist context (match strength + client engagement) on rows.
5. **Customer page** — CRM-style interface (currently "bland"); fix the black
   button(s) next to the client name.
6. **Auction page** — make lots clickable into a full detail view (photo
   gallery, auction/inspection report, full specs) with the member-style
   actions (Request bid / Quote / Watch / Check eligibility).
7. **Mobile audit** — full responsive pass across admin: collapsible filters,
   compact cards, consistent spacing, no cut-off sections, no overflow.
