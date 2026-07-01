// Premium onboarding experience for the public /request page (V2 + Phase-2
// refinements). Still a PROGRESSIVE ENHANCEMENT over one <form> that posts once
// to /request, so createRequest and every server guard are untouched; the wizard
// only changes presentation. Without JavaScript the four steps render stacked as
// one plain form with the normal submit button (safe fallback, no lock-out).
//
//   Step 1 Find car   -> vehicle cards + make/model/year + recent-import examples
//   Step 2 Budget     -> quick budget chips + budget hero + live Market Snapshot
//   Step 3 Review      -> summary (left) + "Why buyers use JDM Connect" (right)
//   Step 4 Account     -> account form + CTA + "What happens next" + human-review note
//
// Direction: light, clean, premium (Stripe / Airbnb onboarding), focused top-nav
// layout (no sidebar). Self-contained light theme scoped under `.ob`.

const CAR_ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 13.5l1.7-4.7A2.4 2.4 0 0 1 7 7.2h10a2.4 2.4 0 0 1 2.3 1.6l1.7 4.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M3 13.5h18v3.4a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.9H6.4v.9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3.4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="7.2" cy="15.2" r="1" fill="currentColor"/><circle cx="16.8" cy="15.2" r="1" fill="currentColor"/></svg>`;

// One-tap popular searches for Step 1. Values map to real feed makers/models; a
// tap fills Make + Model (and loads the model list) so the visitor can refine.
export const POPULAR = [
  { label: "Toyota Alphard", make: "TOYOTA", model: "ALPHARD", desc: "Luxury family mover" },
  { label: "Nissan Skyline", make: "NISSAN", model: "SKYLINE", desc: "Performance icon" },
  { label: "Toyota Crown", make: "TOYOTA", model: "CROWN", desc: "Executive hybrid sedan" },
  { label: "GR Yaris", make: "TOYOTA", model: "GR YARIS", desc: "Rally-bred hot hatch" },
  { label: "Toyota HiAce", make: "TOYOTA", model: "HIACE", desc: "Legendary work van" },
  { label: "Corolla Touring", make: "TOYOTA", model: "COROLLA TOURING", desc: "Hybrid wagon" },
];

// Vehicle cards: image tile + name + descriptor, selectable. The image is a
// branded placeholder tile until real per-model photography is dropped in.
export function popularCards() {
  return `<div class="ob-pop">${POPULAR.map((p) =>
    `<button type="button" class="ob-pop-card" data-make="${p.make}" data-model="${p.model}">
       <span class="ob-pop-img" aria-hidden="true">${CAR_ICON}</span>
       <span class="ob-pop-nm">${p.label}</span>
       <span class="ob-pop-desc">${p.desc}</span>
     </button>`
  ).join("")}</div>`;
}

// Step 1 "recent examples imported": populated by JS from /api/market once a
// make/model is chosen (real sold history -> landed price), placeholder image.
export function recentExamplesShell() {
  return `<div class="ob-recent" id="obRecent" data-state="idle">
    <div class="ob-sub-h">Recent examples imported</div>
    <div class="ob-recent-grid" id="obRecentGrid"></div>
    <p class="ob-recent-hint">Choose a make and model above to see recent landed prices.</p>
  </div>`;
}

// Approved trust stats (figures confirmed by the client for this build).
export function socialProofStrip() {
  const stat = (v, l) => `<div class="ob-stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  return `<div class="ob-proof">
    ${stat("500+", "Vehicles sourced")}
    ${stat("15+", "Years importing")}
    ${stat("100,000+", "Auction listings reviewed")}
    ${stat("Australia-wide", "Delivery network")}
  </div>`;
}

// Step 2 quick-budget chips: tap fills the budget field with the range ceiling.
export function budgetChips() {
  const chip = (val, label) => `<button type="button" class="ob-chip" data-budget="${val}">${label}</button>`;
  return `<div class="ob-chips" role="group" aria-label="Quick budget">
    ${chip(20000, "Under $20k")}
    ${chip(40000, "$20k-40k")}
    ${chip(60000, "$40k-60k")}
    ${chip(100000, "$60k-100k")}
    ${chip(150000, "$100k+")}
  </div>`;
}

// Step 2 side panel: a real buyer testimonial (social proof, warm, human). No
// prices, availability or dates, so nothing on this step reads as a promise.
export function testimonialPanel() {
  return `<aside class="ob-quote">
    <span class="ob-quote-mark" aria-hidden="true">&ldquo;</span>
    <blockquote>I was hesitant because I didn&rsquo;t know how to navigate the import process myself. They were outstanding from start to finish, every step explained.</blockquote>
    <figcaption>WRX buyer</figcaption>
  </aside>`;
}

// Step 3 right column: why buyers choose JDM Connect (trust checklist).
export function whyUs() {
  const li = (t) => `<li>${t}</li>`;
  return `<aside class="ob-why">
    <div class="ob-why-h">Why buyers use JDM Connect</div>
    <ul class="ob-why-list">
      ${li("Daily auction monitoring")}
      ${li("Hand-reviewed matches")}
      ${li("Japan-based sourcing partners")}
      ${li("Landed pricing included")}
      ${li("Australia-wide delivery")}
      ${li("No obligation to buy")}
    </ul>
  </aside>`;
}

// Step 4 right column: what happens after signup + trust indicators.
export function whatHappensNext() {
  const li = (n, t) => `<li><span class="n">${n}</span><span>${t}</span></li>`;
  return `<aside class="ob-next">
    <div class="ob-next-h">What happens next</div>
    <ol class="ob-next-list">
      ${li(1, "Search begins immediately")}
      ${li(2, "Our team reviews matches")}
      ${li(3, "You receive email alerts")}
      ${li(4, "Track everything online")}
    </ol>
    <ul class="ob-trust">
      <li>Free account</li>
      <li>No payment required</li>
      <li>Cancel alerts anytime</li>
      <li>We never share your details</li>
    </ul>
  </aside>`;
}

// Success-page "next steps" timeline.
export function successTimeline() {
  const step = (t, cls) => `<li class="${cls}"><span class="d"></span><span class="t">${t}</span></li>`;
  return `<div class="ob-card ob-timeline">
    <div class="ob-tl-h">Your search has started</div>
    <ol>
      ${step("Search created", "done")}
      ${step("Auction monitoring begins", "active")}
      ${step("Matches reviewed by our team", "")}
      ${step("You'll receive alerts when suitable vehicles appear", "")}
    </ol>
  </div>`;
}

// Success-page support block (call / email / WhatsApp).
export function supportBlock() {
  return `<div class="ob-support">
    <span class="ob-support-h">Need help?</span>
    <div class="ob-support-links">
      <a href="tel:+61415111221">Call us</a>
      <a href="mailto:hello@jdmconnect.com.au">Email us</a>
      <a href="https://wa.me/61415111221" target="_blank" rel="noopener">WhatsApp us</a>
    </div>
  </div>`;
}

export const onboardingCss = `
  .ob{--ink:#181a1d;--t2:#5b606a;--t3:#7a808a;--faint:#9aa0a8;
    --gold:#CAA34C;--gold-d:#9A7B2B;--gold-txt:#7A5E1C;--gold-tint:rgba(202,163,76,0.12);--gold-line:rgba(202,163,76,0.5);
    --card:#ffffff;--surface:#faf9f6;--hair:rgba(23,24,28,0.10);--hair-2:rgba(23,24,28,0.06);
    --field:#ffffff;--field-line:rgba(23,24,28,0.16);--good:#1F7A4D;
    --ease:cubic-bezier(0.2,0.8,0.2,1);
    min-height:100vh;background:var(--surface);color:var(--ink);
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .ob *{box-sizing:border-box}
  .ob a{color:inherit;text-decoration:none}
  .ob ::selection{background:var(--gold-tint);color:var(--ink)}
  .ob :focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:8px}

  .ob input,.ob select,.ob textarea{width:100%;padding:12px 14px;border:1px solid var(--field-line);border-radius:10px;
    font-size:15px;background:var(--field);color:var(--ink);font-family:inherit;transition:border-color .15s,box-shadow .15s}
  .ob input::placeholder{color:var(--faint)}
  .ob select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236F7378' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
  .ob input:focus,.ob select:focus,.ob textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .ob input.bad,.ob select.bad{border-color:#D2453B;box-shadow:0 0 0 3px rgba(210,69,59,0.12)}
  .ob label{display:block;font-size:13px;font-weight:600;color:var(--t2);margin-bottom:7px}
  .ob label .opt{color:var(--faint);font-weight:400}
  .ob .field-err{display:none;color:#B11226;font-size:13px;margin-top:9px;font-weight:500}

  .ob .btn-gold{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--gold);color:#15120A;
    font-size:15px;font-weight:600;border:0;padding:14px 24px;border-radius:10px;cursor:pointer;font-family:inherit;
    transition:background .18s var(--ease),transform .05s,box-shadow .18s}
  .ob .btn-gold:hover{background:#D9B45F;box-shadow:0 6px 18px rgba(202,163,76,0.28)}
  .ob .btn-gold:active{transform:translateY(1px)}
  .ob .btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:var(--ink);
    font-size:15px;font-weight:600;border:1px solid var(--hair);padding:14px 22px;border-radius:10px;cursor:pointer;font-family:inherit;
    transition:border-color .18s,background .18s}
  .ob .btn-ghost:hover{border-color:rgba(23,24,28,0.28);background:var(--surface)}

  /* Top nav */
  .ob-nav{position:sticky;top:0;z-index:40;background:rgba(255,255,255,0.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--hair)}
  .ob-nav-in{max-width:1080px;margin:0 auto;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px}
  .ob-brand{display:flex;align-items:center;gap:11px}
  .ob-brand svg{height:17px;width:auto}
  .ob-brand svg path,.ob-brand svg polygon{fill:var(--ink)}
  .ob-brand .tag{font-size:10px;letter-spacing:0.26em;text-transform:uppercase;color:var(--faint);border-left:1px solid var(--hair);padding-left:11px}
  .ob-signin{font-size:14px;font-weight:600;color:var(--t2);transition:color .15s}
  .ob-signin:hover{color:var(--ink)}

  /* Progress stepper */
  .ob-stepper{position:sticky;top:50px;z-index:30;background:rgba(250,249,246,0.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid var(--hair-2)}
  .ob-steps{max-width:680px;margin:0 auto;padding:18px 28px;display:flex;align-items:center;list-style:none}
  .ob-steps li{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:9px;font-size:12.5px;font-weight:600;color:var(--faint);text-align:center}
  .ob-steps li:not(:last-child):after{content:"";position:absolute;top:15px;left:calc(50% + 18px);width:calc(100% - 36px);height:2px;background:var(--hair);z-index:0;transition:background .4s var(--ease)}
  .ob-steps li .dot{position:relative;z-index:1;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;
    background:#fff;border:1.5px solid var(--hair);color:var(--faint);font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;
    transition:background .3s var(--ease),border-color .3s var(--ease),color .3s var(--ease),transform .3s var(--ease)}
  .ob-steps li.is-active{color:var(--ink)}
  .ob-steps li.is-active .dot{background:var(--gold);border-color:var(--gold);color:#15120A;transform:scale(1.08)}
  .ob-steps li.is-done{color:var(--t2)}
  .ob-steps li.is-done .dot{background:var(--gold-tint);border-color:var(--gold-line);color:transparent}
  .ob-steps li.is-done .dot:after{content:"";position:absolute;width:12px;height:12px;
    background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.3l2.4 2.4 4.6-5' stroke='%237A5E1C' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat}
  .ob-steps li.is-done:after{background:var(--gold-line)}
  @media(max-width:560px){.ob-steps{padding:14px 12px}.ob-steps li{font-size:11px}.ob-steps li:not(:last-child):after{left:calc(50% + 16px);width:calc(100% - 32px)}}

  /* Content */
  .ob-main{max-width:1080px;margin:0 auto;padding:40px 28px 80px}
  .ob-eyebrow{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:12px}
  .ob-step h1{font-size:clamp(25px,3.2vw,36px);font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 12px;color:var(--ink)}
  .ob-lead{font-size:16px;line-height:1.6;color:var(--t2);margin:0 0 28px;max-width:60ch}

  .ob-only{display:none}
  .ob-on .ob-only{display:block}
  .ob-on .ob-nav-btns.ob-only{display:flex}
  .ob-on .ob-step{display:none}
  .ob-on .ob-step.is-active{display:block;animation:obIn .34s var(--ease)}
  .ob-on .ob-nojs{display:none}
  @keyframes obIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){.ob-on .ob-step.is-active{animation:none}.ob *{transition:none!important}}

  .ob-cols{display:grid;grid-template-columns:1.25fr 0.75fr;gap:34px;align-items:start}
  @media(max-width:800px){.ob-cols{grid-template-columns:1fr;gap:24px}}

  /* Social proof */
  .ob-proof{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:34px}
  .ob-stat{background:var(--card);border:1px solid var(--hair);border-radius:12px;padding:15px 16px}
  .ob-stat .v{font-size:20px;font-weight:800;letter-spacing:-0.01em;color:var(--gold-txt);line-height:1}
  .ob-stat .l{font-size:12px;color:var(--t3);margin-top:6px;line-height:1.35}
  @media(max-width:640px){.ob-proof{grid-template-columns:repeat(2,1fr)}}

  .ob-sub-h{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);margin:0 0 12px}

  /* Popular vehicle cards */
  .ob-pop{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px}
  .ob-pop-card{display:flex;flex-direction:column;align-items:stretch;padding:0;background:var(--card);border:1px solid var(--hair);border-radius:14px;
    cursor:pointer;text-align:left;font-family:inherit;overflow:hidden;transition:border-color .2s,box-shadow .2s,transform .2s var(--ease)}
  .ob-pop-card:hover{border-color:var(--gold-line);box-shadow:0 10px 26px rgba(23,24,28,0.08);transform:translateY(-3px)}
  .ob-pop-card.is-on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
  .ob-pop-img{display:flex;align-items:center;justify-content:center;height:78px;color:rgba(202,163,76,0.85);
    background:linear-gradient(135deg,#1b1f26 0%,#2a2f38 100%);position:relative}
  .ob-pop-img:after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 80% 20%,rgba(202,163,76,0.18),transparent 60%)}
  .ob-pop-img svg{width:40px;height:40px;position:relative;z-index:1}
  .ob-pop-card.is-on .ob-pop-img{color:var(--gold)}
  .ob-pop-nm{font-size:14.5px;font-weight:700;color:var(--ink);padding:12px 14px 2px}
  .ob-pop-desc{font-size:12.5px;color:var(--t3);padding:0 14px 14px}
  @media(max-width:640px){
    .ob-pop{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;margin:0 -28px 30px;padding:0 28px 6px}
    .ob-pop-card{flex:0 0 62%;scroll-snap-align:start}
  }

  /* Recent examples */
  .ob-recent{margin:6px 0 30px}
  .ob-recent[data-state=idle] .ob-recent-grid,.ob-recent[data-state=empty] .ob-recent-grid{display:none}
  .ob-recent[data-state=ready] .ob-recent-hint,.ob-recent[data-state=loading] .ob-recent-hint{display:none}
  .ob-recent-hint{font-size:13px;color:var(--t3);margin:0}
  .ob-recent-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .ob-rec-card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--hair);border-radius:12px;overflow:hidden}
  .ob-rec-img{display:flex;align-items:center;justify-content:center;height:64px;color:rgba(202,163,76,0.8);background:linear-gradient(135deg,#1b1f26,#2a2f38)}
  .ob-rec-img svg{width:34px;height:34px}
  .ob-rec-meta{padding:12px 14px}
  .ob-rec-meta .yr{font-size:13.5px;font-weight:700;color:var(--ink);line-height:1.25}
  .ob-rec-meta .pr{font-size:13px;font-weight:700;color:var(--gold-txt);margin-top:5px}
  .ob-rec-card.sk .ob-rec-meta .yr,.ob-rec-card.sk .ob-rec-meta .pr{background:var(--hair);color:transparent;border-radius:5px}
  .ob-rec-card.sk .ob-rec-meta .pr{width:60%}
  .ob-recent[data-state=loading] .ob-rec-img{animation:obShim 1.1s ease-in-out infinite}
  @keyframes obShim{0%,100%{opacity:.6}50%{opacity:1}}
  @media(max-width:640px){
    .ob-recent-grid{display:flex;gap:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory}
    .ob-rec-card{flex:0 0 66%;scroll-snap-align:start}
  }

  .ob-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:560px){.ob-fields{grid-template-columns:1fr}}

  /* Budget chips */
  .ob-chips{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:18px}
  .ob-chip{font-size:13.5px;font-weight:600;color:var(--t2);background:var(--card);border:1px solid var(--hair);border-radius:999px;
    padding:9px 16px;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s,color .15s}
  .ob-chip:hover{border-color:var(--gold-line)}
  .ob-chip.is-on{background:var(--gold-tint);border-color:var(--gold);color:var(--gold-txt)}

  /* Budget hero */
  .ob-budget{max-width:440px}
  .ob-budget .in{position:relative;display:flex;align-items:center}
  .ob-budget .in .cur{position:absolute;left:16px;font-size:24px;font-weight:800;color:var(--gold-txt);pointer-events:none}
  .ob-budget .in input{font-size:27px;font-weight:800;padding:16px 16px 16px 54px;letter-spacing:-0.01em}
  details.ob-refine{margin-top:22px;border-top:1px solid var(--hair);padding-top:16px}
  details.ob-refine>summary{cursor:pointer;list-style:none;font-size:14px;font-weight:600;color:var(--gold-txt)}
  details.ob-refine>summary::-webkit-details-marker{display:none}
  details.ob-refine[open]>summary{margin-bottom:16px}

  /* Step 2 testimonial */
  .ob-quote{background:var(--surface);border:1px solid var(--hair);border-radius:14px;padding:26px 26px;position:sticky;top:110px}
  .ob-quote-mark{display:block;font-size:54px;line-height:.5;color:var(--gold);font-weight:800;height:30px}
  .ob-quote blockquote{font-size:17px;line-height:1.55;color:var(--ink);margin:12px 0 0;font-weight:500}
  .ob-quote figcaption{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-txt);margin-top:20px;padding-top:16px;border-top:1px solid var(--hair)}

  /* Review (step 3) */
  .ob-review{background:var(--card);border:1px solid var(--gold-line);border-radius:14px;padding:24px 26px;box-shadow:0 10px 30px rgba(202,163,76,0.08)}
  .ob-review .rk{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-txt);margin:0 0 16px}
  .ob-review ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
  .ob-review li{display:flex;align-items:flex-start;gap:12px;font-size:16px;color:var(--ink);line-height:1.35}
  .ob-review li .tick{flex:none;width:22px;height:22px;border-radius:999px;background:var(--gold);color:#15120A;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;margin-top:1px}
  .ob-review .rv-extra{font-size:13.5px;color:var(--t2);margin-top:4px}
  .ob-note{font-size:15px;line-height:1.62;color:var(--t2);max-width:64ch;margin:18px 0 0}

  /* Why us (step 3 right) */
  .ob-why{background:var(--surface);border:1px solid var(--hair);border-radius:14px;padding:22px 24px;position:sticky;top:110px}
  .ob-why-h{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:14px}
  .ob-why-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
  .ob-why-list li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--t2);line-height:1.4}
  .ob-why-list li:before{content:"";flex:none;width:18px;height:18px;margin-top:1px;border-radius:999px;background:var(--gold-tint);border:1px solid var(--gold-line);
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2l2.2 2.3 4.8-5' stroke='%237A5E1C' stroke-width='1.9' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center}

  /* What happens next (step 4 right) */
  .ob-next{background:var(--surface);border:1px solid var(--hair);border-radius:14px;padding:22px 24px;position:sticky;top:110px}
  .ob-next-h{font-size:13px;font-weight:700;letter-spacing:.04em;color:var(--ink);margin-bottom:16px}
  .ob-next-list{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:14px}
  .ob-next-list li{display:flex;align-items:flex-start;gap:12px;font-size:14px;line-height:1.4;color:var(--t2)}
  .ob-next-list li .n{flex:none;width:22px;height:22px;border-radius:999px;background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .ob-trust{list-style:none;margin:0;padding:16px 0 0;border-top:1px solid var(--hair);display:flex;flex-direction:column;gap:10px}
  .ob-trust li{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:var(--t2)}
  .ob-trust li:before{content:"";flex:none;width:17px;height:17px;border-radius:999px;background:var(--gold-tint);border:1px solid var(--gold-line);
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2l2.2 2.3 4.8-5' stroke='%237A5E1C' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center}

  /* Human-review reassurance line */
  .ob-human{display:flex;align-items:flex-start;gap:11px;margin-top:20px;padding:15px 17px;background:var(--gold-tint);border:1px solid var(--gold-line);border-radius:12px;
    font-size:14px;line-height:1.5;color:var(--ink)}
  .ob-human svg{flex:none;width:20px;height:20px;color:var(--gold-d);margin-top:1px}

  /* Nav buttons */
  .ob-nav-btns{display:flex;align-items:center;gap:12px;margin-top:28px;flex-wrap:wrap}
  .ob-nav-btns .ob-next-btn{margin-left:auto}
  .ob-nav-btns .ob-back{order:-1}
  .ob-cta-row{display:flex;align-items:center;gap:12px;margin-top:22px;flex-wrap:wrap}
  .ob-cta-row .btn-gold{flex:1;min-width:200px}
  @media(max-width:640px){
    .ob-on .ob-nav-btns{position:sticky;bottom:0;z-index:20;margin-top:22px;padding:14px 0;gap:10px;
      background:linear-gradient(180deg,rgba(250,249,246,0) 0%,var(--surface) 30%);border-top:1px solid var(--hair)}
    .ob-nav-btns .ob-next-btn{flex:1;min-height:52px}
    .ob-cta-row .btn-gold{width:100%}
  }

  /* Success page */
  .ob-success{max-width:760px;margin:0 auto}
  .ob-success .ob-badge{display:inline-flex;align-items:center;gap:9px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-txt);margin-bottom:16px}
  .ob-success .ob-badge .tk{width:22px;height:22px;border-radius:999px;background:var(--gold);color:#15120A;display:flex;align-items:center;justify-content:center;font-size:12px}
  .ob-success h1{font-size:clamp(28px,4vw,40px);font-weight:800;letter-spacing:-0.02em;margin:0 0 10px}
  .ob-success .ob-sub{font-size:16px;color:var(--t2);line-height:1.6;margin:0 0 26px;max-width:60ch}
  .ob-card{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:24px 26px;margin-bottom:22px}
  .ob-summary{list-style:none;margin:0;padding:0}
  .ob-summary li{display:flex;align-items:flex-start;gap:11px;font-size:16px;color:var(--ink);padding:7px 0}
  .ob-summary li .tick{flex:none;width:20px;height:20px;border-radius:999px;background:var(--gold);color:#15120A;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-top:2px}
  .ob-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--hair);border:1px solid var(--hair);border-radius:12px;overflow:hidden;margin-bottom:22px}
  .ob-meta .c{background:var(--card);padding:16px 18px}
  .ob-meta .k{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
  .ob-meta .v{font-size:15px;font-weight:700;color:var(--ink);margin-top:6px;line-height:1.3}
  .ob-meta .v .ok{color:var(--good)}
  @media(max-width:560px){.ob-meta{grid-template-columns:1fr}}
  /* Timeline */
  .ob-timeline .ob-tl-h{font-size:13px;font-weight:700;letter-spacing:.04em;color:var(--ink);margin-bottom:18px}
  .ob-timeline ol{list-style:none;margin:0;padding:0}
  .ob-timeline li{position:relative;padding:0 0 22px 30px}
  .ob-timeline li:last-child{padding-bottom:0}
  .ob-timeline li .d{position:absolute;left:0;top:2px;width:16px;height:16px;border-radius:999px;background:#fff;border:2px solid var(--hair);z-index:1}
  .ob-timeline li:not(:last-child):before{content:"";position:absolute;left:7px;top:14px;bottom:0;width:2px;background:var(--hair)}
  .ob-timeline li.done .d{background:var(--gold);border-color:var(--gold)}
  .ob-timeline li.done:not(:last-child):before{background:var(--gold-line)}
  .ob-timeline li.active .d{background:#fff;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint)}
  .ob-timeline li .t{font-size:14.5px;color:var(--ink);font-weight:600}
  .ob-timeline li:not(.done):not(.active) .t{color:var(--t3);font-weight:500}
  .ob-success .ob-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}
  .ob-note-sm{font-size:13px;color:var(--t3);margin:16px 0;line-height:1.55}
  /* Support */
  .ob-support{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:26px;padding-top:22px;border-top:1px solid var(--hair)}
  .ob-support-h{font-size:14px;font-weight:700;color:var(--ink)}
  .ob-support-links{display:flex;gap:10px;flex-wrap:wrap}
  .ob-support-links a{font-size:13.5px;font-weight:600;color:var(--gold-txt);border:1px solid var(--gold-line);border-radius:999px;padding:8px 15px;transition:background .15s}
  .ob-support-links a:hover{background:var(--gold-tint)}
`;

// Client controller. Injected numbers only; degrades safely.
export function wizardScript({ pwMin, pwMax, budgetMin }) {
  return `<script>(function(){
    var form=document.getElementById('requestForm'); if(!form) return;
    var root=document.querySelector('.ob'); if(!root) return;
    var steps=[].slice.call(form.querySelectorAll('.ob-step'));
    if(steps.length<2) return;
    var stepper=document.getElementById('obSteps');
    var dots=stepper?[].slice.call(stepper.querySelectorAll('li')):[];
    var DRAFT='jdmReqDraft';
    var PMIN=${Number(pwMin)}, PMAX=${Number(pwMax)}, BMIN=${Number(budgetMin)};
    var ALLOWED=/^[A-Za-z0-9!@#$%^&*()\\-_=+?<>]*$/;
    var cur=1, max=steps.length;

    function el(n){return form.querySelector('[name="'+n+'"]');}
    function val(n){var e=el(n);return e?String(e.value||'').trim():'';}
    function errEl(id){return document.getElementById(id);}
    function showErr(id,on){var e=errEl(id); if(e) e.style.display=on?'block':'none';}
    function emailBad(){var v=val('email');return !v||!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v);}
    function pwBad(){var e=el('portal_password');var v=e?e.value:'';return v.length<PMIN||v.length>PMAX||!ALLOWED.test(v)||!/[A-Za-z]/.test(v)||!/[0-9]/.test(v);}
    function vehicleBad(){return !val('marka_name')||!val('model_name');}
    function yearBad(){var f=parseInt(val('year_min'),10),t=parseInt(val('year_max'),10);return !val('year_min')||!val('year_max')||!isFinite(f)||!isFinite(t)||f>t;}
    function budgetBad(){var n=parseFloat(val('budget_aud'));return !isFinite(n)||n<BMIN;}
    function badField(n){
      if(n===1){var vb=vehicleBad(),yb=yearBad();showErr('rq-vehicle-error',vb);showErr('rq-year-error',yb);return vb?'rq-vehicle-error':(yb?'rq-year-error':null);}
      if(n===2){var bb=budgetBad();showErr('rq-budget-error',bb);return bb?'rq-budget-error':null;}
      if(n===4){var eb=emailBad(),pb=pwBad();showErr('rq-email-error',eb);showErr('rq-pass-error',pb);return eb?'rq-email-error':(pb?'rq-pass-error':null);}
      return null;
    }

    function fmtAud(n){return 'A$'+Math.round(n).toLocaleString('en-AU');}
    function buildReview(){
      var box=document.getElementById('obReview'); if(!box) return;
      var mk=val('marka_name'), md=val('model_name'), yf=val('year_min'), yt=val('year_max'), st=val('state');
      var bn=parseFloat(val('budget_aud'));
      var rows=[], car=[mk,md].filter(Boolean).join(' ');
      rows.push('<li><span class="tick">&#10003;</span><span><b>'+(car||'Your vehicle')+'</b></span></li>');
      if(yf&&yt) rows.push('<li><span class="tick">&#10003;</span><span>'+yf+' to '+yt+'</span></li>');
      if(isFinite(bn)) rows.push('<li><span class="tick">&#10003;</span><span>Budget up to '+fmtAud(bn)+' all-in</span></li>');
      if(st) rows.push('<li><span class="tick">&#10003;</span><span>Registered in '+st+'</span></li>');
      var extra=[];
      if(val('mileage_max')) extra.push('under '+parseInt(val('mileage_max'),10).toLocaleString('en-AU')+' km');
      if(val('rate_min')) extra.push('grade '+val('rate_min')+'+');
      if(val('kuzov')) extra.push('chassis '+val('kuzov'));
      var ex=extra.length?'<div class="rv-extra">Also: '+extra.join(' &middot; ')+'</div>':'';
      box.innerHTML='<div class="rk">We\\u2019re searching for</div><ul>'+rows.join('')+'</ul>'+ex;
    }

    // ---- Recent examples (Step 1): real recent sold vehicles, year + model only
    // (no prices - we deliberately don't put a figure on them). ----
    var recKey='', recData=null;
    function setRecentState(s){var b=document.getElementById('obRecent');if(b)b.setAttribute('data-state',s);}
    var CARSVG='${CAR_ICON.replace(/'/g, "\\'")}';
    function titleCase(s){return String(s||'').toLowerCase().replace(/\\b[a-z]/g,function(c){return c.toUpperCase();});}
    function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function fillRecent(d){
      var grid=document.getElementById('obRecentGrid'); if(!grid) return;
      if(!d||!d.ok||!d.recent||!d.recent.length){ setRecentState('empty'); return; }
      grid.innerHTML=d.recent.map(function(r){
        var name=[r.year,titleCase(r.make),titleCase(r.model)].filter(Boolean).join(' ');
        return '<div class="ob-rec-card"><span class="ob-rec-img">'+CARSVG+'</span><div class="ob-rec-meta"><div class="yr">'+esc(name)+'</div></div></div>';
      }).join('');
      setRecentState('ready');
    }
    function loadRecent(){
      if(!document.getElementById('obRecent')) return;
      var mk=val('marka_name'), md=val('model_name');
      if(!mk||!md){ recKey=''; recData=null; setRecentState('idle'); return; }
      var key=mk+'|'+md+'|'+val('year_min')+'|'+val('year_max');
      if(key===recKey){ if(recData) fillRecent(recData); return; }
      recKey=key; setRecentState('loading');
      var q='/api/market?make='+encodeURIComponent(mk)+'&model='+encodeURIComponent(md)+'&yearMin='+encodeURIComponent(val('year_min'))+'&yearMax='+encodeURIComponent(val('year_max'));
      fetch(q).then(function(r){return r.json();}).then(function(d){ if(recKey!==key) return; recData=d; fillRecent(d); }).catch(function(){ if(recKey===key) setRecentState('empty'); });
    }

    function focusFirst(sec){var f=sec.querySelector('input:not([type=hidden]):not([tabindex="-1"]),select,textarea,button.ob-pop-card');if(f){try{f.focus({preventScroll:true});}catch(e){try{f.focus();}catch(e2){}}}}
    function render(){
      steps.forEach(function(s){s.classList.toggle('is-active',parseInt(s.getAttribute('data-step'),10)===cur);});
      dots.forEach(function(d,i){var n=i+1;d.classList.toggle('is-active',n===cur);d.classList.toggle('is-done',n<cur);});
      if(cur===1) loadRecent();
      if(cur===3) buildReview();
      var a=steps[cur-1];
      if(a){ if(a.scrollIntoView) a.scrollIntoView({behavior:'smooth',block:'start'}); focusFirst(a); }
    }
    function go(n){ if(n<1||n>max) return; cur=n; render(); save(); }
    function next(){ var bad=badField(cur); if(bad){var e=errEl(bad); if(e&&e.scrollIntoView)e.scrollIntoView({behavior:'smooth',block:'center'}); return;} go(cur+1); }
    function back(){ go(cur-1); }

    // Popular cards fill make + model, then refresh market data.
    [].slice.call(form.querySelectorAll('.ob-pop-card')).forEach(function(card){
      card.addEventListener('click',function(){
        var mk=el('marka_name'), want=card.getAttribute('data-model')||'', mkWant=(card.getAttribute('data-make')||'').toUpperCase();
        if(mk){ if(mk.tagName==='SELECT'){ for(var i=0;i<mk.options.length;i++){ if((mk.options[i].value||'').toUpperCase()===mkWant){ mk.value=mk.options[i].value; break; } } } else { mk.value=mkWant; } }
        if(window.jdmLoadModels) window.jdmLoadModels(want); else { var md=el('model_name'); if(md) md.value=want; }
        [].slice.call(form.querySelectorAll('.ob-pop-card')).forEach(function(c){c.classList.toggle('is-on',c===card);});
        showErr('rq-vehicle-error',false); recKey=''; setTimeout(loadRecent,60); save();
      });
    });

    // Budget chips fill the budget field.
    [].slice.call(form.querySelectorAll('.ob-chip')).forEach(function(chip){
      chip.addEventListener('click',function(){
        var b=el('budget_aud'); if(b){ b.value=chip.getAttribute('data-budget'); b.classList.remove('bad'); }
        [].slice.call(form.querySelectorAll('.ob-chip')).forEach(function(c){c.classList.toggle('is-on',c===chip);});
        showErr('rq-budget-error',false); save();
      });
    });

    // Refresh recent examples/market when the model changes on step 1.
    var mdEl=el('model_name'); if(mdEl) mdEl.addEventListener('change',function(){ recKey=''; loadRecent(); });

    // ---- autosave / resume ----
    var NAMES=['name','email','whatsapp','state','marka_name','model_name','year_min','year_max','budget_aud','mileage_max','rate_min','kuzov','label'];
    var t;
    function save(){ try{var d={step:cur,f:{}};NAMES.forEach(function(n){var e=el(n);if(e&&e.value)d.f[n]=e.value;});localStorage.setItem(DRAFT,JSON.stringify(d));}catch(e){} }
    function saveSoon(){ clearTimeout(t); t=setTimeout(save,400); }
    function restore(){
      var raw; try{raw=localStorage.getItem(DRAFT);}catch(e){return 1;}
      if(!raw) return 1;
      var d; try{d=JSON.parse(raw);}catch(e){return 1;}
      var f=d&&d.f||{};
      NAMES.forEach(function(n){var e=el(n);if(e&&!e.value&&f[n]!=null){e.value=f[n];}});
      if(f.marka_name&&window.jdmLoadModels){window.jdmLoadModels(f.model_name||'');}
      var want=Math.min(max,Math.max(1,parseInt(d.step,10)||1)), reach=1;
      while(reach<want && !badField(reach)) reach++;
      ['rq-vehicle-error','rq-year-error','rq-budget-error','rq-email-error','rq-pass-error'].forEach(function(id){showErr(id,false);});
      return reach;
    }

    form.querySelectorAll('[data-next]').forEach(function(b){b.addEventListener('click',next);});
    form.querySelectorAll('[data-back]').forEach(function(b){b.addEventListener('click',back);});
    form.addEventListener('keydown',function(e){ if(e.key!=='Enter')return; var tag=(e.target.tagName||'').toLowerCase(); if(tag==='textarea'||tag==='button')return; if(cur<max){e.preventDefault();next();} });

    // Inline validation: flag on blur, clear as they fix it (never wait for submit).
    function liveField(name,errId,badFn){var e=el(name);if(!e)return;
      e.addEventListener('blur',function(){var b=badFn();e.classList.toggle('bad',!!(e.value&&b));showErr(errId,!!(e.value&&b));});
      e.addEventListener('input',function(){if(!badFn()){e.classList.remove('bad');showErr(errId,false);}});
    }
    liveField('email','rq-email-error',emailBad);
    liveField('portal_password','rq-pass-error',pwBad);
    liveField('budget_aud','rq-budget-error',budgetBad);

    form.addEventListener('input',saveSoon);
    form.addEventListener('change',save);
    form.addEventListener('submit',function(e){
      var order=[1,2,4], firstBad=0;
      for(var i=0;i<order.length;i++){ if(badField(order[i])){ firstBad=order[i]; break; } }
      if(firstBad){ e.preventDefault(); if(cur!==firstBad) go(firstBad); var b=badField(firstBad); var el2=b&&errEl(b); if(el2&&el2.scrollIntoView) el2.scrollIntoView({behavior:'smooth',block:'center'}); return; }
      try{localStorage.removeItem(DRAFT);}catch(err){}
      var btn=form.querySelector('button[type=submit]'); if(btn){btn.disabled=true;btn.textContent='Starting your search\\u2026';}
    });

    root.classList.add('ob-on');
    var startAttr=parseInt(form.getAttribute('data-error-step'),10);
    if(startAttr>=1){ cur=startAttr; } else { cur=restore(); }
    render();
  })();</script>`;
}
