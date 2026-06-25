// Public landing page (the front door for jdmfinder.com.au and
// finder.jdmconnect.com.au). Replaces the old bare redirect into the request
// form with a real home that explains the service and gives a clear path to
// start a search or sign in.
//
// Visual direction (frontend-design skill): dark luxury, editorial, with
// auction-sheet precision. It deliberately rhymes with the spec-sheet Matches
// cards in the staff app: tabular mono numerals, a divided stat strip, a sample
// match panel. One directed load reveal, no scattered micro-interactions.
//
// Standalone marketing page (no sidebar). Reuses the dark brand layer from
// theme.js: charcoal background, warm gold accent, rising-sun motif used
// sparingly, Inter for UI text. Copy rule: no em dashes or en dashes anywhere.
// Use commas, periods, or hyphens.

import { LOGO, risingSun, brandDoc } from "./theme.js";

// Landing-only layout, scoped on top of the shared theme tokens (var(--gold)
// etc. come from themeCss, which brandDoc injects). Kept here so the shared
// stylesheet does not carry marketing-only classes onto every admin page.
const landingCss = `
  :root{--mono:ui-monospace,"SF Mono","JetBrains Mono","Cascadia Code",Menlo,Consolas,monospace}
  .lpage{position:relative;overflow:hidden;background:var(--bg)}

  /* Atmosphere: a warm glow pooled top-right plus a faint precision grid, so the
     page reads as a layered surface rather than a flat fill. */
  .latmos{position:absolute;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(1100px 560px at 82% -8%,rgba(202,163,76,0.16),transparent 60%),
      radial-gradient(900px 600px at 10% 4%,rgba(202,163,76,0.05),transparent 55%),
      linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px);
    background-size:auto,auto,46px 46px,46px 46px;
    -webkit-mask-image:linear-gradient(180deg,#000 0,#000 62%,transparent 100%);
            mask-image:linear-gradient(180deg,#000 0,#000 62%,transparent 100%)}

  .lnav{position:sticky;top:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:16px;
    padding:18px 32px;background:rgba(10,12,15,0.7);backdrop-filter:blur(10px);border-bottom:1px solid var(--hair)}
  .lnav .ln-brand svg{width:166px}
  .lnav .ln-right{display:flex;align-items:center;gap:10px}
  .lnav a.ln-signin{color:var(--t2);font-size:14px;font-weight:600;padding:9px 14px;border-radius:8px}
  .lnav a.ln-signin:hover{color:var(--ink);background:rgba(255,255,255,0.05)}

  /* HERO: editorial, asymmetric. Copy on the left, a sample match panel offset
     to the right so the two layers overlap and create depth. */
  .lhero{position:relative;z-index:1}
  .lhero .risingsun{right:-90px;top:-130px;z-index:0}
  .hero-grid{position:relative;z-index:1;max-width:1140px;margin:0 auto;padding:72px 32px 36px;
    display:grid;grid-template-columns:1.08fr 0.92fr;gap:54px;align-items:center}
  .hero-copy{min-width:0}
  .hero-copy h1{font-size:clamp(38px,5vw,62px);font-weight:800;line-height:1.02;letter-spacing:-0.03em;margin:18px 0 0}
  .hero-copy h1 .accent{color:var(--gold-txt)}
  .hero-copy .lsub{color:var(--t2);font-size:clamp(15px,1.35vw,18px);line-height:1.58;margin:20px 0 0;max-width:52ch}
  .cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
  .cta-row .btn-gold,.cta-row .btn-dark{padding:14px 24px;font-size:15px}
  .hero-proof{margin:22px 0 0;display:flex;align-items:center;gap:9px;color:var(--faint);font-size:13px}
  .hero-proof .hp-dots{display:inline-flex}
  .hero-proof .hp-dots i{width:20px;height:20px;border-radius:9999px;border:1.5px solid var(--bg);margin-left:-7px;
    display:inline-block;background:var(--card-2)}
  .hero-proof .hp-dots i:first-child{margin-left:0}

  /* Sample match panel: a clean auction spec sheet, mono numerals, gold landed
     line. Mirrors the staff Matches card so the brand is one language. */
  .specpanel{position:relative;background:linear-gradient(180deg,var(--card-2),var(--card));
    border:1px solid var(--hair);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
  .specpanel:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold)}
  .sp-tag{position:absolute;top:14px;right:14px;z-index:2;font-size:10px;font-weight:700;letter-spacing:0.1em;
    text-transform:uppercase;color:var(--faint);background:rgba(0,0,0,0.35);border:1px solid var(--hair);
    padding:4px 9px;border-radius:9999px}
  .sp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px 0}
  .sp-lot{font-family:var(--mono);font-size:12px;letter-spacing:0.06em;color:var(--t3)}
  .sp-str{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:0.04em;
    text-transform:uppercase;color:var(--good)}
  .sp-str .sd{width:8px;height:8px;border-radius:9999px;background:var(--good);box-shadow:0 0 0 4px var(--good-bg)}
  .sp-title{padding:12px 22px 0}
  .sp-title .t{font-size:21px;font-weight:700;letter-spacing:-0.015em}
  .sp-title .a{font-size:12.5px;color:var(--t3);margin-top:4px}
  .sp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--hair);
    margin:18px 0 0;border-top:1px solid var(--hair)}
  .sp-cell{background:var(--card);padding:13px 22px}
  .sp-cell .k{font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:var(--faint)}
  .sp-cell .v{font-family:var(--mono);font-size:16px;font-weight:600;color:var(--ink);margin-top:5px}
  .sp-land{display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:15px 22px;background:rgba(202,163,76,0.08);border-top:1px solid var(--gold-line)}
  .sp-land .lk{font-size:10.5px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--gold-txt)}
  .sp-land .lv{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--ink)}
  .sp-foot{display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--hair)}
  .sp-foot .av{width:26px;height:26px;border-radius:9999px;background:var(--gold-tint);border:1px solid var(--gold-line);
    color:var(--gold-txt);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
  .sp-foot .ft{font-size:12.5px;color:var(--t2)}
  .sp-foot .ft b{color:var(--ink);font-weight:600}

  /* Divided stat strip, in the app's auction-sheet idiom. Honest facts, no
     invented metrics. */
  .lstats{position:relative;z-index:1;max-width:1140px;margin:14px auto 0;padding:0 32px}
  .lstats-in{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--hair);border-radius:14px;
    background:var(--bg-2);overflow:hidden}
  .lstat{padding:20px 22px;border-left:1px solid var(--hair)}
  .lstat:first-child{border-left:0}
  .lstat .sv{font-family:var(--mono);font-size:18px;font-weight:700;color:var(--gold-txt);letter-spacing:-0.01em}
  .lstat .sl{font-size:12.5px;color:var(--t3);margin-top:6px;line-height:1.4}

  .lwrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:0 32px}
  .lsec{padding:72px 0;border-bottom:1px solid var(--hair-2)}
  .lsec-head{max-width:60ch}
  .lsec-head.center{text-align:center;margin:0 auto}
  .lsec-head h2{font-size:clamp(25px,2.7vw,34px);font-weight:700;letter-spacing:-0.025em;margin:10px 0 0}
  .lsec-head p{color:var(--t3);font-size:15.5px;line-height:1.55;margin:13px 0 0}

  /* HOW IT WORKS: an editorial numbered flow, not a card pile. Oversized ghost
     numerals, a connecting hairline, generous whitespace. */
  .flow{margin-top:42px;display:grid;grid-template-columns:repeat(3,1fr);gap:28px;position:relative}
  .flow:before{content:"";position:absolute;top:34px;left:8%;right:8%;height:1px;
    background:linear-gradient(90deg,transparent,var(--gold-line),transparent)}
  .fstep{position:relative}
  .fstep .fn{font-family:var(--mono);font-size:54px;font-weight:700;line-height:1;color:transparent;
    -webkit-text-stroke:1.2px var(--gold-line);background:var(--bg);display:inline-block;padding:0 14px;position:relative}
  .fstep h3{font-size:18px;font-weight:700;letter-spacing:-0.01em;margin:20px 0 0}
  .fstep p{color:var(--t3);font-size:14px;line-height:1.58;margin:10px 0 0;max-width:34ch}

  /* WHY: a bento layout, asymmetric on purpose. One lead tile spans, the rest
     stack, so emphasis is uneven instead of a flat 2x2. */
  .bento{margin-top:42px;display:grid;grid-template-columns:1.25fr 1fr;grid-auto-rows:1fr;gap:18px}
  .btile{background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:26px 26px;position:relative;
    transition:border-color .2s,transform .2s}
  .btile:hover{border-color:var(--gold-line);transform:translateY(-3px)}
  .btile .bi{width:42px;height:42px;border-radius:11px;background:var(--gold-tint);border:1px solid var(--gold-line);
    color:var(--gold-txt);display:flex;align-items:center;justify-content:center}
  .btile .bi svg{width:22px;height:22px}
  .btile h3{font-size:17px;font-weight:700;letter-spacing:-0.01em;margin:18px 0 0}
  .btile p{color:var(--t3);font-size:14px;line-height:1.58;margin:9px 0 0}
  .btile.lead{grid-row:span 2;display:flex;flex-direction:column;
    background:linear-gradient(180deg,rgba(202,163,76,0.09),var(--card))}
  .btile.lead h3{font-size:22px;margin-top:auto}
  .btile.lead p{font-size:15px;max-width:38ch}

  .lprice .lsec-head{margin-bottom:36px}
  .lprice-note{text-align:center;color:var(--faint);font-size:13px;margin:24px auto 0;max-width:54ch;line-height:1.5}
  .tier .tier-price{font-family:var(--mono)}

  .lcta{position:relative;z-index:1;text-align:center;padding:84px 24px;overflow:hidden}
  .lcta .risingsun{left:50%;top:-40px;transform:translateX(-50%)}
  .lcta-in{position:relative;z-index:1}
  .lcta h2{font-size:clamp(28px,3.2vw,40px);font-weight:800;letter-spacing:-0.025em;margin:0}
  .lcta p{color:var(--t2);font-size:16px;margin:15px auto 0;max-width:46ch;line-height:1.55}
  .lcta .cta-row{justify-content:center;margin-top:28px}

  .lfoot{position:relative;z-index:1;border-top:1px solid var(--hair);background:var(--bg-2);padding:36px 32px}
  .lfoot-in{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
  .lfoot svg{width:150px}
  .lfoot .lf-links{display:flex;gap:20px;flex-wrap:wrap}
  .lfoot .lf-links a{color:var(--t3);font-size:14px;font-weight:500}
  .lfoot .lf-links a:hover{color:var(--ink)}
  .lfoot .lf-fine{color:var(--faint);font-size:12.5px;width:100%;margin-top:18px;border-top:1px solid var(--hair-2);padding-top:16px}

  /* One directed load reveal. Pure CSS so no-JS still shows everything; fully
     skipped under reduced-motion. */
  @media(prefers-reduced-motion:no-preference){
    .reveal{opacity:0;animation:lrise .72s cubic-bezier(0.16,1,0.3,1) forwards}
    .d1{animation-delay:.04s}.d2{animation-delay:.12s}.d3{animation-delay:.2s}
    .d4{animation-delay:.28s}.d5{animation-delay:.4s}.d6{animation-delay:.52s}
  }
  @keyframes lrise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}

  @media(max-width:900px){
    .hero-grid{grid-template-columns:1fr;gap:36px;padding-top:52px}
    .hero-panel{max-width:440px}
    .lstats-in{grid-template-columns:repeat(2,1fr)}
    .lstat:nth-child(-n+2){border-top:0}.lstat:nth-child(3),.lstat:nth-child(4){border-top:1px solid var(--hair)}
    .lstat:nth-child(odd){border-left:0}
    .flow{grid-template-columns:1fr;gap:14px}.flow:before{display:none}
    .fstep{display:flex;align-items:baseline;gap:18px}.fstep .fn{font-size:40px;padding:0}
    .fstep h3{margin-top:0}
    .bento{grid-template-columns:1fr}.btile.lead{grid-row:auto}.btile.lead h3{margin-top:0}
  }
  @media(max-width:560px){.lnav{padding:14px 18px}.hero-grid,.lstats,.lwrap,.lfoot{padding-left:20px;padding-right:20px}
    .lsec{padding:54px 0}}
`;

// Inline icons for the feature tiles (inherit currentColor).
const I = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  coins: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.4 7.7-8 9-4.6-1.3-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  layout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
};

const fstep = (n, title, body) =>
  `<div class="fstep"><span class="fn">${n}</span><h3>${title}</h3><p>${body}</p></div>`;

const tier = ({ tag, name, price, per, sub, feats, cta, ctaHref, featured }) => `
  <div class="tier${featured ? " feature" : ""}">
    ${tag ? `<span class="tier-tag">${tag}</span>` : ""}
    <div class="tier-name">${name}</div>
    <div class="tier-price">${price}${per ? `<span class="per"> ${per}</span>` : ""}</div>
    <div class="tier-sub">${sub}</div>
    <ul>${feats.map((f) => `<li>${f}</li>`).join("")}</ul>
    <a class="${featured ? "btn-gold" : "btn-dark"}" href="${ctaHref}">${cta}</a>
  </div>`;

// The full landing document. `env` is accepted for parity with the other page
// builders (and future dynamic content) but the page is currently static.
export function landingPage(env) {
  const body = `
  <style>${landingCss}</style>
  <div class="lpage">
    <div class="latmos" aria-hidden="true"></div>

    <header class="lnav">
      <a class="ln-brand" href="/" aria-label="JDM Connect home">${LOGO}</a>
      <div class="ln-right">
        <a class="ln-signin" href="/login">Sign in</a>
        <a class="btn-gold" href="/request">Start your search</a>
      </div>
    </header>

    <section class="lhero">
      ${risingSun({ size: 540, tone: "soft" })}
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="kicker reveal d1">Vehicle Finder</div>
          <h1 class="reveal d2">The car you want, pulled from the <span class="accent">Japanese auctions</span>.</h1>
          <p class="lsub reveal d3">Tell us what you are after. We watch the auctions across Japan every day, check every match by hand, and bring you the ones worth importing, landed cost and eligibility included.</p>
          <div class="cta-row reveal d4">
            <a class="btn-gold" href="/request">Start your search</a>
            <a class="btn-dark" href="/login">Sign in to your account</a>
          </div>
          <div class="hero-proof reveal d4">
            <span class="hp-dots"><i></i><i></i><i></i></span>
            Buyers across Australia, sourcing from USS, TAA, ZIP and more.
          </div>
        </div>
        <div class="hero-panel reveal d5">
          <div class="specpanel">
            <span class="sp-tag">Sample match</span>
            <div class="sp-head">
              <span class="sp-lot">LOT 65333</span>
              <span class="sp-str"><span class="sd"></span> Strong match</span>
            </div>
            <div class="sp-title">
              <div class="t">1999 Nissan Skyline GT-R</div>
              <div class="a">USS Tokyo, auction Thursday</div>
            </div>
            <div class="sp-grid">
              <div class="sp-cell"><div class="k">Grade</div><div class="v">4</div></div>
              <div class="sp-cell"><div class="k">Odometer</div><div class="v">88,000 km</div></div>
              <div class="sp-cell"><div class="k">Chassis</div><div class="v">BNR34</div></div>
              <div class="sp-cell"><div class="k">Transmission</div><div class="v">6 speed</div></div>
            </div>
            <div class="sp-land">
              <span class="lk">Landed to VIC</span>
              <span class="lv">A$118,500</span>
            </div>
            <div class="sp-foot">
              <span class="av">JR</span>
              <span class="ft"><b>Match for Jordan</b>, reviewed by our team</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="lstats reveal d6">
      <div class="lstats-in">
        <div class="lstat"><div class="sv">Every 6 hours</div><div class="sl">We sweep the Japanese auction feeds</div></div>
        <div class="lstat"><div class="sv">By hand</div><div class="sl">Every match reviewed before you see it</div></div>
        <div class="lstat"><div class="sv">To your door</div><div class="sl">Landed cost estimated on each car</div></div>
        <div class="lstat"><div class="sv">SEVS + age</div><div class="sl">Import eligibility checked up front</div></div>
      </div>
    </div>

    <div class="lwrap">
      <section class="lsec">
        <div class="lsec-head">
          <div class="kicker">How it works</div>
          <h2>Three steps to your next car</h2>
          <p>No account needed to start. Tell us what you are after and we take it from there.</p>
        </div>
        <div class="flow">
          ${fstep("01", "Tell us what you want", "Make, model, years, budget and condition. It takes a couple of minutes, and you do not need an account to begin.")}
          ${fstep("02", "We watch the auctions", "Every day across Japan's auction houses. We check the grade, the mileage and the auction sheet on every match.")}
          ${fstep("03", "You get reviewed matches", "We only send cars we would buy ourselves, each with a landed-cost estimate and eligibility. Place a deposit when you are ready.")}
        </div>
      </section>

      <section class="lsec">
        <div class="lsec-head">
          <div class="kicker">Why JDM Connect</div>
          <h2>Real cars, checked by real people</h2>
          <p>We import JDM vehicles to Australia for a living. The finder is the same process we use ourselves, opened up to you.</p>
        </div>
        <div class="bento">
          <div class="btile lead">
            <div class="bi">${I.check}</div>
            <h3>Every match checked by hand</h3>
            <p>No spam listings, no auto-blasted alerts. A person reviews the grade, the auction sheet and the history before a car ever reaches you, so what lands in your inbox is worth your time.</p>
          </div>
          <div class="btile">
            <div class="bi">${I.coins}</div>
            <h3>Landed cost, not just the bid</h3>
            <p>Each car comes with an estimate to your door, from the same calculator we use internally.</p>
          </div>
          <div class="btile">
            <div class="bi">${I.shield}</div>
            <h3>Eligibility built in</h3>
            <p>We flag SEVS and age eligibility up front, so you never chase a car you cannot register here.</p>
          </div>
        </div>
      </section>

      <section class="lsec lprice">
        <div class="lsec-head center">
          <div class="kicker" style="justify-content:center">Membership</div>
          <h2>Start free, upgrade when you are serious</h2>
          <p>Browse and request for free. Members get unlimited searches and first look at every car we source.</p>
        </div>
        <div class="pricegrid">
          ${tier({
            name: "Browse",
            price: "Free",
            sub: "Tell us what you want and track your search.",
            feats: [
              "Submit a vehicle request",
              "Your own dashboard",
              "See matches we have reviewed",
              "Email when a car comes up",
            ],
            cta: "Start free",
            ctaHref: "/request",
          })}
          ${tier({
            tag: "Founding members",
            name: "Importer",
            price: "A$12",
            per: "/ month",
            sub: "First 100 members, normally A$19. Yearly billing available.",
            feats: [
              "Everything in Browse",
              "Unlimited active searches",
              "Priority sourcing on every match",
              "Landed-cost estimate on each car",
              "Place a deposit to secure a car",
            ],
            cta: "Start your search",
            ctaHref: "/request",
            featured: true,
          })}
        </div>
        <p class="lprice-note">Start free today. We will set up your membership when your search goes live, no card needed to begin.</p>
      </section>
    </div>

    <section class="lcta">
      ${risingSun({ size: 460, tone: "faint" })}
      <div class="lcta-in">
        <h2>Ready to find your car?</h2>
        <p>Tell us what you are after. We will start watching the auctions today.</p>
        <div class="cta-row">
          <a class="btn-gold" href="/request">Start your search</a>
          <a class="btn-dark" href="/login">Sign in</a>
        </div>
      </div>
    </section>

    <footer class="lfoot">
      <div class="lfoot-in">
        ${LOGO}
        <nav class="lf-links" aria-label="Footer">
          <a href="/request">Start a request</a>
          <a href="/login">Sign in</a>
        </nav>
        <p class="lf-fine">JDM Connect. Japanese vehicle imports to Australia. We use your details only to search for and contact you about matching vehicles, and never share them with third parties.</p>
      </div>
    </footer>
  </div>`;
  return brandDoc(body, "JDM Connect Vehicle Finder, find your JDM car at Japanese auction");
}
