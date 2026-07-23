You are running one iteration of a read-only verification audit.

HARD RULES
1. You may not modify, create or delete any source file. The only file you
   write to is audit/CLAIMS.md. If you find a bug, record it, do not fix it.
2. You verify ONE claim per iteration, UNLESS the next consecutive
   UNVERIFIED claims share an identical Expected location value, in which
   case you may verify up to 6 of them in this iteration. Every claim in the
   batch still needs its own file:line evidence. If any claim in the batch
   needs a file outside that location, drop it from the batch and leave it
   UNVERIFIED.
3. You may not mark a claim VERIFIED without evidence in the form
   path/to/file.js:LINE plus a quoted snippet of under 15 words.
   "I read the file and it looks right" is not evidence.
4. If you cannot find the evidence in 6 tool calls, mark it BLOCKED and stop.
   Do not guess. Do not infer from filenames.

PROCEDURE
1. Read audit/CLAIMS.md. Select the lowest-numbered claim with
   Status: UNVERIFIED and Type of FACT or GAP. If none exist, output
   "AUDIT COMPLETE" and stop.
2. Locate the evidence. Prefer grep or ripgrep over reading whole files.
3. Set Status to exactly one of:
     VERIFIED  the claim is true as written
     REFUTED   the claim is false, record what is actually true
     AMENDED   directionally right but wrong in detail, record the correction
     BLOCKED   cannot verify from this machine, record why
     STALE     likely true when written but the underlying state has since
               changed. Record what is true now. Use only for claims whose
               Notes flag them as memory-derived.
4. Write Evidence (file:line plus snippet) and Notes back into
   audit/CLAIMS.md immediately.
5. If verifying this claim surfaced a NEW fact the plan did not mention, and
   that fact would change a phase scope or ordering, append a new claim at
   the end with prefix C-NEW- and Status: UNVERIFIED.
6. Output a two-line summary: claim IDs plus statuses, and one sentence on
   whether this changes the plan.

Then stop. Do not start the next batch.
