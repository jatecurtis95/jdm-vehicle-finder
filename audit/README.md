# audit/ - consolidated audit and planning documents

Single canonical home for JDM Connect finder audit and planning material,
consolidated on 2026-07-23 on branch chore/audit-consolidation. "Newest version
wins" was applied to duplicates. Nothing was deleted. Where two files shared a
name but differed, both were kept under distinct names.

## Contents and provenance

Build charter and evidence base (from C:\Users\jatec\Projects\audit, the actively
maintained audit working directory):
- BUILD.md - authoritative build charter (299 lines, 22 Jul 2026, cross-references
  claim IDs C-xxx). Governs the build; where it conflicts with PLAN.md or Ben's
  notes, it wins.
- CLAIMS.md - claim-by-claim evidence base.
- FINDINGS.md - audit findings summary. Read before acting on any phase.
- PHASE3_PRODUCTION_DATA.md - production data snapshot for the Phase 3 cutover.
- LOOP_PROMPT.md, log.txt - audit loop prompt and run log.
- BUILD.perf-branch-snapshot.md - the shorter 195-line BUILD.md committed on
  perf/phase1-2-speed. Preserved for reference; superseded by BUILD.md above.

Plans:
- PLAN.md - reconstructed, audit-annotated plan (379 lines) from perf/phase1-2-speed.
- PLAN-root.md - the top-level Projects\PLAN.md master (134 lines, 22 Jul 14:10),
  a distinct shorter document with inline [AUDIT] annotations. Kept separately so
  neither plan is lost.

Performance work (from perf/phase1-2-speed):
- PERFORMANCE.md, PERF_RESULTS.md, PHASE0_PLAN.md, PROGRESS.md, perf/* fixtures
  and measurement scripts.

Code, flow and UI audits (were uncommitted on main, 21 Jul 2026, preserved on
rescue/main-wip-2026-07-23):
- CODE_AUDIT.md, FLOW_AUDIT.md, UI_AUDIT.md.

Ben V1.2 site notes status (13 Jul 2026):
- ben-notes-v12-status.html and "Finder Site Notes V1.2 - Status.pdf" (same content).

## Decisions and exceptions (logged)

- COLOUR-AUDIT.md, DESIGN-AUDIT.md and IA-AUDIT.md remain at the repository root,
  not moved into audit/. They are committed on main and referenced by 16 source
  and test files. Moving them would require editing source and tests outside the
  scope of a documentation-consolidation task and risk the test suite. Relocating
  them with reference updates is a separate follow-up.
- docs/phase3-plan was missing from origin at consolidation time, so PHASE3_PLAN_V2.md
  and PHASE3_CHECKS.md could not be included. They must be added once that branch is
  pushed. Task 6 (Phase 3 cutover) depends on them.
- The uncommitted avg-sold tool (scripts/avg-sold.mjs and its package.json "avg"
  alias) was not folded in here. It is unrelated to audit docs and is preserved on
  rescue/main-wip-2026-07-23 for a separate decision.

## Addendum 2026-07-23

Phase 3 planning docs added from origin/docs/phase3-plan: PHASE3_PLAN_V2.md (current), PHASE3_PLAN.md (V1), PHASE3_CHECKS.md. Note: Phase 3 is planning only, there is no Phase 3 code yet; implementation was deliberately stopped before the users-table migration.
