// Public landing page (the front door for jdmfinder.com.au and
// finder.jdmconnect.com.au). Replaces the old bare redirect straight into the
// request form: visitors now get a real home that explains the service, shows
// how it works, and offers a clear path to start a search or sign in.
//
// Standalone marketing page (no sidebar). Reuses the dark brand layer from
// theme.js: dark charcoal background, warm gold accent, the rising-sun motif
// used sparingly, Inter for UI text. Copy rule: no em dashes or en dashes
// anywhere. Use commas, periods, or hyphens.

import { LOGO, risingSun, brandDoc } from "./theme.js";

// Landing-only layout, scoped on top of the shared theme tokens (var(--gold)
// etc. come from themeCss, which brandDoc injects). Kept here so the shared
// stylesheet does not carry marketing-only classes onto every admin page.
const landingCss = `
  .lpage{position:relative;overflow:hidden}
  .lnav{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;
    padding:18px 32px;background:rgba(10,12,15,0.82);backdrop-filter:blur(8px);border-bottom:1px solid var(--hair)}
  .lnav .ln-brand svg{width:166px}
  .lnav .ln-right{display:flex;align-items:center;gap:10px}
  .lnav a.ln-signin{color:var(--t2);font-size:14px;font-weight:600;padding:9px 14px;border-radius:8px}
  .lnav a.ln-signin:hover{color:var(--ink);background:rgba(255,255,255,0.05)}

  .lhero{position:relative;text-align:center;padding:84px 24px 72px;border-bottom:1px solid var(--hair);background:var(--bg-2)}
  .lhero .risingsun{left:50%;top:-110px;transform:translateX(-50%)}
  .lhero-in{position:relative;z-index:1;max-width:760px;margin:0 auto}
  .lhero h1{font-size:clamp(34px,4.4vw,56px);line-height:1.05;letter-spacing:-0.025em;margin:18px 0 0}
  .lhero h1 .accent{color:var(--gold-txt)}
  .lhero .lsub{color:var(--t2);font-size:clamp(15px,1.4vw,19px);line-height:1.55;margin:18px auto 0;max-width:60ch}
  .lhero .cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:30px}
  .lhero .cta-row .btn-gold,.lhero .cta-row .btn-dark{padding:14px 26px;font-size:15px}
  .ltrust{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:26px}

  .lwrap{max-width:1080px;margin:0 auto;padding:0 24px}
  .lsec{padding:68px 0;border-bottom:1px solid var(--hair-2)}
  .lsec-head{text-align:center;max-width:62ch;margin:0 auto 40px}
  .lsec-head h2{font-size:clamp(24px,2.6vw,32px);letter-spacing:-0.02em;margin:10px 0 0}
  .lsec-head p{color:var(--t3);font-size:15.5px;line-height:1.55;margin:12px 0 0}

  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  .step{position:relative;background:var(--card);border:1px solid var(--hair);border-radius:var(--radius);padding:26px 24px}
  .step .sn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;
    background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);font-weight:700;font-size:15px}
  .step h3{font-size:17px;margin:16px 0 0;letter-spacing:-0.01em}
  .step p{color:var(--t3);font-size:14px;line-height:1.55;margin:9px 0 0}

  .feat{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
  .fcard{background:var(--card);border:1px solid var(--hair);border-radius:var(--radius);padding:24px 24px;display:flex;gap:15px;align-items:flex-start}
  .fcard .fi{flex:0 0 auto;width:40px;height:40px;border-radius:10px;background:var(--gold-tint);border:1px solid var(--gold-line);
    display:flex;align-items:center;justify-content:center;color:var(--gold-txt)}
  .fcard .fi svg{width:21px;height:21px}
  .fcard h3{font-size:16px;margin:2px 0 0;letter-spacing:-0.01em}
  .fcard p{color:var(--t3);font-size:14px;line-height:1.55;margin:8px 0 0}

  .lprice .lsec-head{margin-bottom:34px}
  .lprice-note{text-align:center;color:var(--faint);font-size:13px;margin:22px auto 0;max-width:52ch;line-height:1.5}

  .lcta{text-align:center;padding:70px 24px}
  .lcta h2{font-size:clamp(26px,3vw,36px);letter-spacing:-0.02em;margin:0}
  .lcta p{color:var(--t3);font-size:16px;margin:14px auto 0;max-width:48ch;line-height:1.55}
  .lcta .cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:28px}

  .lfoot{border-top:1px solid var(--hair);background:var(--bg-2);padding:34px 24px}
  .lfoot-in{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
  .lfoot svg{width:150px}
  .lfoot .lf-links{display:flex;gap:20px;flex-wrap:wrap}
  .lfoot .lf-links a{color:var(--t3);font-size:14px;font-weight:500}
  .lfoot .lf-links a:hover{color:var(--ink)}
  .lfoot .lf-fine{color:var(--faint);font-size:12.5px;width:100%;margin-top:18px;border-top:1px solid var(--hair-2);padding-top:16px}

  @media(max-width:820px){.steps{grid-template-columns:1fr}.feat{grid-template-columns:1fr}}
  @media(max-width:560px){.lnav{padding:14px 18px}.lhero{padding:60px 20px 52px}.lsec{padding:52px 0}}
`;

// Small inline icons for the feature cards (inherit currentColor).
const I = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  coins: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.4 7.7-8 9-4.6-1.3-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  layout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
};

const step = (n, title, body) =>
  `<div class="step"><span class="sn">${n}</span><h3>${title}</h3><p>${body}</p></div>`;

const feature = (icon, title, body) =>
  `<div class="fcard"><div class="fi">${icon}</div><div><h3>${title}</h3><p>${body}</p></div></div>`;

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
    <header class="lnav">
      <a class="ln-brand" href="/" aria-label="JDM Connect home">${LOGO}</a>
      <div class="ln-right">
        <a class="ln-signin" href="/login">Sign in</a>
        <a class="btn-gold" href="/request">Start your search</a>
      </div>
    </header>

    <section class="lhero">
      ${risingSun({ size: 560, tone: "soft" })}
      <div class="lhero-in">
        <div class="kicker" style="justify-content:center">Vehicle Finder</div>
        <h1>Find your JDM car, straight from the <span class="accent">Japanese auctions</span>.</h1>
        <p class="lsub">Tell us the car you want. We watch the Japanese auctions every day, check every match by hand, and bring you the ones worth importing, with a landed-cost estimate and import eligibility included.</p>
        <div class="cta-row">
          <a class="btn-gold" href="/request">Start your search</a>
          <a class="btn-dark" href="/login">Sign in to your account</a>
        </div>
        <div class="ltrust">
          <span class="chip muted">Auction sheet translation</span>
          <span class="chip muted">SEVS eligibility checks</span>
          <span class="chip muted">Landed cost to your door</span>
        </div>
      </div>
    </section>

    <div class="lwrap">
      <section class="lsec">
        <div class="lsec-head">
          <div class="kicker" style="justify-content:center">How it works</div>
          <h2>Three steps to your next car</h2>
          <p>No account needed to start. Tell us what you are after and we take it from there.</p>
        </div>
        <div class="steps">
          ${step("1", "Tell us what you want", "Make, model, years, budget and condition. It takes a couple of minutes, and you do not need an account to begin.")}
          ${step("2", "We watch the auctions", "Every day across Japan's auction houses. We check the grade, the mileage and the auction sheet on every match.")}
          ${step("3", "You get reviewed matches", "We only send cars we would buy ourselves, each with a landed-cost estimate and import eligibility. Place a deposit when you are ready.")}
        </div>
      </section>

      <section class="lsec">
        <div class="lsec-head">
          <div class="kicker" style="justify-content:center">Why JDM Connect</div>
          <h2>Real cars, checked by real people</h2>
          <p>We import JDM vehicles to Australia for a living. The finder is the same process we use ourselves, opened up to you.</p>
        </div>
        <div class="feat">
          ${feature(I.check, "Every match checked by hand", "No spam listings or auto-blasted alerts. A person reviews the grade, the sheet and the history before a car reaches you.")}
          ${feature(I.coins, "Landed cost, not just the bid", "Each car comes with an estimate to your door, built from the same calculator we use internally, so the number is real.")}
          ${feature(I.shield, "Import eligibility built in", "We flag SEVS and age eligibility up front, so you never fall for a car you cannot register in Australia.")}
          ${feature(I.layout, "Your own dashboard", "Create a free account to track your search and see every car we find for you, all in one place.")}
        </div>
      </section>

      <section class="lsec lprice">
        <div class="lsec-head">
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
            sub: "First 100 members, normally A$19. Billed yearly available.",
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
      ${risingSun({ size: 420, tone: "faint" })}
      <div style="position:relative;z-index:1">
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
