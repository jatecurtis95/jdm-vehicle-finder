// JDM Connect design system (Stage 0).
//
// One canonical brand layer reused across every customer-facing surface: the
// public request form, the buyer portal, login / set-password, and the public
// vehicle browse and pricing pages added later. Dark charcoal background, a warm
// gold accent, the rising-sun motif used sparingly, Inter for UI text.
//
// The class names here deliberately mirror the staff app so existing markup
// re-themes with no churn. The internal staff admin keeps its lighter theme for
// now; this module is the brand for everything a buyer or the public can see.
//
// Copy rule for this codebase: no em dashes or en dashes anywhere. Use commas,
// periods, or hyphens.

export const FONT = `"Inter",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif`;

// Official JDM Connect horizontal lockup (inline SVG). The paths carry no fill,
// so on a dark surface we tint them to the cream ink via CSS (.brand svg path).
export const LOGO = `<svg viewBox="0 0 431.98 45.66" width="190" height="20" style="max-width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="JDM Connect">
<polygon points="133.86 45.51 150.93 .54 169.49 .54 182.2 31.95 215.18 .55 232.49 .54 215.4 45.5 201.57 45.51 213.16 14.41 181.27 45.51 172.35 45.51 159.78 13.79 147.44 45.51 133.86 45.51"></polygon>
<path d="M60.77,45.5L77.84.52h47.87c8.59,0,15.68.61,11.7,11.11-1.04,2.73-5.67,15.91-9.97,23.88-5.23,9.69-10.58,10.02-21.73,10.02l-44.94-.02ZM78.98,37.5h27.61c4.47,0,6.88-1.65,8.81-3.84,2.14-2.43,7.07-14.79,7.97-18.27,1.24-4.84-1.45-6.83-10.08-6.83h-23.43l-.14.44-10.74,28.5Z"></path>
<path d="M68.56.52c-2.18,5.74-4.3,11.29-6.59,17.33-6.74,17.77-8.86,27.67-29.03,27.67H-.05l3.15-7.98,28.65-.03c5.98-.43,8.57-2.77,11.03-8.22,2.93-6.47,4.88-13.89,7.73-20.45h-15.96c.96-2.78,1.76-5.94,3.4-8.32h30.61Z"></path>
<path d="M252.07,21.74h-10.75c-3.68,0-5.88-1.31-6.97-3.44-.94-1.84-1-4.35.05-7.13,1.16-3.06,3.48-5.85,6.25-7.78,2.47-1.72,5.33-2.78,8.65-2.78h10.75l-2.11,5.6h-10.75c-1.85,0-3.21.53-4.41,1.38-1.28.91-2.36,2.22-2.89,3.63-.48,1.28-.45,2.47.01,3.34.5,1,1.57,1.63,3.52,1.63h10.75l-2.1,5.57Z"></path>
<path d="M266.66,21.74c-3.68,0-5.88-1.31-6.97-3.44-.94-1.84-1-4.35.05-7.13,1.16-3.06,3.48-5.85,6.25-7.78,2.47-1.72,5.33-2.78,8.65-2.78h4.31c3.31,0,5.37,1.06,6.54,2.78,1.3,1.94,1.53,4.72.37,7.78-1.05,2.78-3,5.28-5.33,7.13-2.69,2.13-5.89,3.44-9.56,3.44h-4.31ZM272.52,6.2c-1.85,0-3.21.53-4.41,1.38-1.28.91-2.36,2.22-2.89,3.63-.48,1.28-.45,2.47.01,3.34.5,1,1.57,1.63,3.52,1.63h4.31c1.94,0,3.49-.63,4.74-1.63,1.12-.87,2.06-2.06,2.54-3.34.53-1.41.45-2.72-.15-3.63-.56-.84-1.52-1.38-3.37-1.38h-4.31Z"></path>
<path d="M313.83,17.64c-1.2,3.19-3.56,4.53-5.57,4.53-1.73,0-2.85-.5-3.39-1.66l-6.21-13.41c-.08-.19-.2-.28-.38-.28-.27,0-.6.22-.74.59l-5.4,14.32h-5.41l6.29-16.66c1.36-3.6,3.87-4.94,6.63-4.94,1.94,0,2.96.53,3.64,2.09l5.37,12.35c.07.22.24.25.42.25.24,0,.5-.19.64-.56l5.15-13.66h5.38l-6.43,17.04Z"></path>
<path d="M344.64,17.64c-1.2,3.19-3.56,4.53-5.57,4.53-1.73,0-2.85-.5-3.39-1.66l-6.21-13.41c-.08-.19-.2-.28-.38-.28-.27,0-.6.22-.74.59l-5.4,14.32h-5.41l6.29-16.66c1.36-3.6,3.87-4.94,6.63-4.94,1.94,0,2.96.53,3.65,2.09l5.37,12.35c.07.22.24.25.42.25.24,0,.5-.19.64-.56l5.15-13.66h5.38l-6.43,17.04Z"></path>
<path d="M377.95.6l-2.11,5.6h-15.61c-.33,0-.56.19-.69.53l-.91,2.41h16.01l-1.53,4.06h-16.01l-.97,2.56c-.14.38-.06.56.27.56h15.61l-2.04,5.41h-18.71c-1.91,0-2.52-.97-1.78-2.94l5.79-15.35c.72-1.91,2.05-2.85,3.99-2.85h18.68Z"></path>
<path d="M396.04,21.74h-10.75c-3.68,0-5.88-1.31-6.97-3.44-.94-1.84-1-4.35.05-7.13,1.16-3.06,3.48-5.85,6.25-7.78,2.47-1.72,5.33-2.78,8.64-2.78h10.75l-2.11,5.6h-10.75c-1.85,0-3.21.53-4.41,1.38-1.28.91-2.36,2.22-2.89,3.63-.48,1.28-.45,2.47.01,3.34.5,1,1.57,1.63,3.52,1.63h10.75l-2.1,5.57Z"></path>
<path d="M432.03.6l-2.11,5.6h-8.99l-5.86,15.54h-5.53l5.86-15.54h-9.02l2.11-5.6h23.54Z"></path>
</svg>`;

// Rising-sun motif. A single half-disc with a fan of rays, used sparingly behind
// brand headers and as a quiet signature. `tone` picks the opacity weight so it
// can sit behind text without fighting it. Decorative only (aria-hidden).
export function risingSun({ size = 320, tone = "soft" } = {}) {
  const op = tone === "bold" ? 0.5 : tone === "faint" ? 0.12 : 0.26;
  const rays = Array.from({ length: 9 }, (_, i) => {
    const a = (-90 + i * 22.5) * (Math.PI / 180);
    const x = 100 + Math.cos(a) * 96;
    const y = 100 + Math.sin(a) * 96;
    return `<line x1="100" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="url(#rg)" stroke-width="3" stroke-linecap="round"/>`;
  }).join("");
  return `<svg class="risingsun" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 200 200" style="opacity:${op}">
    <defs>
      <radialGradient id="rg" cx="50%" cy="100%" r="100%">
        <stop offset="0%" stop-color="#E8C977"/>
        <stop offset="55%" stop-color="#CAA34C"/>
        <stop offset="100%" stop-color="#CAA34C" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="46" fill="url(#rg)"/>
    ${rays}
  </svg>`;
}

// The dark brand stylesheet. Mirrors the staff-app class names so portal and
// request markup theme cleanly, with a product-grade dark palette layered on top.
export const themeCss = `
  /* Inter is loaded via preconnected <link> tags in brandDoc()'s <head>, so it
     no longer render-blocks behind this stylesheet's @import. */
  :root{
    --gold:#CAA34C;--gold-hover:#D9B45F;--gold-txt:#E6C879;--gold-tint:rgba(202,163,76,0.14);--gold-line:rgba(202,163,76,0.34);
    --ink:#F4F2EC;--t2:#C9CCD1;--t3:#9BA0A7;--faint:#888D95;--ph:#7A808A;
    --bg:#0F1115;--bg-2:#0A0C0F;--card:#171A20;--card-2:#1C2027;--off:#13161B;
    --hair:rgba(255,255,255,0.08);--hair-2:rgba(255,255,255,0.05);
    --field:#1B1F26;--field-line:rgba(255,255,255,0.14);
    --good:#5BC08C;--good-bg:rgba(91,192,140,0.13);--good-line:rgba(91,192,140,0.4);
    --bad:#E2607A;--bad-bg:rgba(226,96,122,0.1);--bad-line:rgba(226,96,122,0.34);
    --warn:#E0A94B;
    --radius:10px;--shadow:0 18px 50px rgba(0,0,0,0.45);
    --mono:ui-monospace,"SF Mono","JetBrains Mono","Cascadia Code",Menlo,Consolas,monospace;
  }
  /* Light workspace for app-style shells (request form, buyer portal). The
     sidebar (.side) keeps the dark brand from :root; only .main goes light.
     The marketing landing (.lpage) and login (.login-screen) don't use .main,
     so they stay fully dark. Mirrors the staff admin's dark-rail/light-content. */
  .main{
    color:var(--ink);
    --ink:#1b1c1e;--t2:#5b606a;--t3:#6b7079;--faint:#656a73;--ph:#6C717A;
    --bg:#f4f4f1;--bg-2:#ffffff;--card:#ffffff;--card-2:#ffffff;--off:#f7f7f5;
    --hair:rgba(0,0,0,0.10);--hair-2:rgba(0,0,0,0.06);
    --field:#fbfbfc;--field-line:rgba(0,0,0,0.14);
    --gold-txt:#7A5E1C;--warn:#8a5e10;
    --good:#1F7A4D;--good-bg:#E1F5EE;--good-line:rgba(31,122,77,0.35);
    --bad:#B11226;--bad-bg:rgba(177,18,38,0.06);--bad-line:rgba(177,18,38,0.3);
  }
  .main input:focus,.main select:focus,.main textarea:focus{background:#ffffff}
  .main select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236F7378' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")}
  .main .btn-dark{background:#f1f0ec}
  .main .btn-dark:hover{background:#e8e7e1}
  .main .btn-toggle.off{background:#f1f0ec}
  .main .chip.muted{background:#f1f0ec}
  .main .wledit summary:hover{background:rgba(0,0,0,0.03)}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;font-family:${FONT};color:var(--ink);background:var(--bg);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;line-height:1.5}
  a{color:inherit;text-decoration:none}
  /* Visually-hidden skip link: off-screen until keyboard focus, then it
     snaps to the top-left as a visible gold box. Targets #main (present on
     the sidebar shell); harmless where that anchor is absent. */
  .skip-link{position:absolute;left:-9999px;top:0;z-index:10000;padding:10px 16px;background:var(--gold);color:#15120A;font-weight:700;font-size:14px;border-radius:0 0 8px 0;font-family:${FONT}}
  .skip-link:focus{left:0;outline:2px solid var(--ink);outline-offset:2px}
  ::selection{background:var(--gold-tint);color:var(--ink)}
  .risingsun{position:absolute;pointer-events:none;z-index:0}

  /* Shell: sidebar + main (buyer portal) */
  .wrap{display:flex;min-height:100vh;position:relative;background:var(--bg)}
  .side{width:264px;flex:0 0 264px;border-right:1px solid var(--hair);display:flex;flex-direction:column;padding:28px 20px;background:var(--bg-2);position:sticky;top:0;align-self:flex-start;height:100vh;overflow-y:auto}
  .side .brand{padding:2px 6px 22px;margin-bottom:18px;border-bottom:1px solid var(--hair)}
  .brand svg path,.brand svg polygon,.login-logo svg path,.login-logo svg polygon{fill:var(--ink)}
  .nav{display:flex;flex-direction:column;gap:3px}
  .nav a{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:8px;font-size:15px;color:var(--t2);transition:background .15s,color .15s}
  .nav a .bar{width:3px;height:17px;border-radius:2px;background:transparent}
  .nav a .lbl{flex:1}
  .nav a .ct{font-size:13px;color:var(--faint);font-weight:500}
  .nav a.active{background:var(--gold-tint);color:var(--ink);font-weight:600}
  .nav a.active .bar{background:var(--gold)}
  .nav a.active .ct{color:var(--gold-txt)}
  .nav a:hover:not(.active){background:rgba(255,255,255,0.04);color:var(--ink)}
  .side-foot{margin-top:auto;display:flex;flex-direction:column;gap:14px;padding-top:20px}
  .whoami{display:flex;flex-direction:column;align-items:center;gap:2px;padding:2px 0}
  .whoami .who-name{font-size:13px;font-weight:600;color:var(--ink)}
  .whoami .who-role{font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold-txt)}
  .signout{display:block;text-align:center;color:var(--t3);font-size:13px;padding:10px;border-radius:8px;border:1px solid var(--hair)}
  .signout:hover{background:rgba(255,255,255,0.04);color:var(--ink)}

  .main{flex:1;min-width:0;background:var(--bg);display:flex;flex-direction:column;position:relative;z-index:1}
  .topbar{position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;background:var(--bg-2);padding:34px 40px 28px;border-bottom:1px solid var(--hair);overflow:hidden}
  .topbar .topbar-in{position:relative;z-index:1}
  .topbar>div:not(.topbar-in){position:relative;z-index:1}
  .topbar .btn-dark{position:relative;z-index:1}
  .kicker{display:flex;align-items:center;gap:10px;color:var(--gold-txt);font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase}
  .kicker:before{content:"";width:26px;height:1px;background:var(--gold);display:inline-block}
  h1{font-size:34px;font-weight:700;letter-spacing:-0.02em;margin:13px 0 7px;line-height:1.04;color:var(--ink);text-wrap:balance}
  .subline{color:var(--t3);font-size:15px;margin:0;max-width:60ch;text-wrap:balance}
  .content{padding:32px 40px 64px;max-width:1180px;width:100%;position:relative;z-index:1}

  /* Cards + forms */
  .card{background:var(--card);border:1px solid var(--hair);border-radius:var(--radius);padding:26px 28px;margin-bottom:24px}
  .card h2{font-size:16px;font-weight:600;margin:0 0 20px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--hair);padding-bottom:16px;color:var(--ink);text-wrap:balance}
  .card h2 .num{color:var(--gold);font-weight:700}
  details.foldcard>summary{font-size:16px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;margin:0}
  details.foldcard>summary::-webkit-details-marker{display:none}
  details.foldcard>summary::after{content:"+";margin-left:auto;color:var(--gold);font-weight:700;font-size:21px;line-height:1;transition:transform .15s}
  details.foldcard[open]>summary{border-bottom:1px solid var(--hair);padding-bottom:16px;margin-bottom:20px}
  details.foldcard[open]>summary::after{transform:rotate(45deg)}
  details.morefields{margin:4px 0 2px;border-top:1px dashed var(--hair);padding-top:16px}
  details.morefields>summary{cursor:pointer;color:var(--gold-txt);font-weight:600;font-size:14px;list-style:none}
  details.morefields>summary::-webkit-details-marker{display:none}
  details.morefields[open]>summary{margin-bottom:16px}
  .memcard{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;background:var(--card);border:1px solid var(--gold-line);border-left:4px solid var(--gold);border-radius:var(--radius);padding:20px 24px;margin-bottom:24px}
  .memcard.is-member{border-color:var(--good-line);border-left-color:var(--good)}
  .memcard .mem-tag{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-txt)}
  .memcard.is-member .mem-tag{color:var(--good)}
  .memcard .mem-h{font-size:18px;font-weight:700;margin-top:4px;color:var(--ink)}
  .memcard .mem-s{font-size:13.5px;color:var(--t2);margin-top:4px;max-width:54ch;line-height:1.5}
  .memcard form{margin:0;flex:0 0 auto}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 22px}
  label{display:block;font-size:12px;color:var(--t2);margin-bottom:7px;font-weight:600;letter-spacing:0.02em}
  label .opt{color:var(--faint);font-weight:400;text-transform:none;letter-spacing:0}
  input,select,textarea{width:100%;padding:12px 13px;border:1px solid var(--field-line);border-radius:7px;font-size:14px;background:var(--field);color:var(--ink);font-family:${FONT};transition:border-color .15s,box-shadow .15s}
  input::placeholder,textarea::placeholder{color:var(--ph)}
  select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239BA0A7' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-tint);background:#20242C}
  .actions{display:flex;align-items:center;gap:14px;margin-top:24px;flex-wrap:wrap}
  .help{color:var(--faint);font-size:13px;line-height:1.5}

  /* Buttons */
  .btn-gold,.btn-dark,.btn-notify,.btn-search{touch-action:manipulation}
  .btn-gold{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--gold);color:#15120A;font-weight:700;border:0;padding:12px 22px;border-radius:8px;font-size:14px;cursor:pointer;font-family:${FONT};transition:background .15s,transform .05s}
  .btn-gold:hover{background:var(--gold-hover)}
  .btn-gold:active{transform:translateY(1px)}
  .btn-dark,.btn-notify{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgba(255,255,255,0.06);color:var(--ink);font-weight:600;border:1px solid var(--hair);padding:11px 18px;border-radius:8px;font-size:14px;cursor:pointer;font-family:${FONT};white-space:nowrap;transition:background .15s,border-color .15s}
  .btn-dark:hover,.btn-notify:hover{background:rgba(255,255,255,0.1);border-color:var(--gold-line)}
  .btn-notify{background:var(--gold);color:#15120A;border:0;font-weight:700}
  .btn-notify:hover{background:var(--gold-hover)}
  .btn-search{display:flex;align-items:center;justify-content:center;gap:9px;background:var(--gold);color:#15120A;font-weight:700;padding:13px;border-radius:8px;font-size:15px}
  .btn-search:hover{background:var(--gold-hover)}
  .btn-search .dot{width:7px;height:7px;border-radius:9999px;background:#15120A;display:inline-block}
  .btn-skip{color:var(--t3);font-size:13px;padding:9px 8px;border-radius:7px}
  .btn-skip:hover{color:var(--ink)}
  .btn-toggle{border:1px solid var(--hair);font-size:12px;font-weight:600;padding:7px 14px;border-radius:9999px;cursor:pointer;background:transparent;color:var(--t2);font-family:${FONT}}
  .btn-toggle.on{background:var(--gold-tint);border-color:var(--gold-line);color:var(--gold-txt)}
  .btn-toggle.off{background:rgba(255,255,255,0.04);color:var(--t3)}
  .btn-del{background:transparent;border:1px solid var(--bad-line);color:var(--bad);font-size:12px;font-weight:600;padding:7px 12px;border-radius:7px;cursor:pointer;font-family:${FONT}}
  .btn-del:hover{background:var(--bad-bg)}
  .btn-link{background:transparent;border:0;color:var(--gold-txt);font-size:13px;font-weight:600;padding:7px 8px;cursor:pointer;font-family:${FONT}}
  .btn-link:hover{text-decoration:underline}

  /* Badges, chips, banners, eligibility */
  .chip{display:inline-block;background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);font-size:11px;font-weight:600;padding:4px 10px;border-radius:9999px;font-family:${FONT}}
  .chip.muted{background:rgba(255,255,255,0.05);border-color:var(--hair);color:var(--t3)}
  .badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;letter-spacing:.03em;padding:5px 11px;border-radius:9999px;text-transform:uppercase}
  .badge .bd{width:7px;height:7px;border-radius:9999px;display:inline-block;background:currentColor}
  .badge.ok{color:var(--good);background:var(--good-bg);border:1px solid var(--good-line)}
  .badge.warn{color:var(--warn);background:var(--gold-tint);border:1px solid var(--gold-line)}
  .badge.no{color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line)}
  .elig{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px}
  .elig.ok{color:var(--good);background:var(--good-bg);border:1px solid var(--good-line)}
  .elig.check{color:var(--warn);background:var(--gold-tint);border:1px solid var(--gold-line)}
  .elig.no{color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line)}
  .reqbadge{display:inline-flex;align-items:center;gap:7px;background:var(--good-bg);border:1px solid var(--good-line);color:var(--good);font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:9999px}
  .paybadge{display:inline-flex;align-items:center;gap:6px;background:var(--gold-tint);border:1px solid var(--gold-line);color:var(--gold-txt);font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:9999px;margin-left:8px}
  .banner{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding:15px 20px;background:var(--card);border:1px solid var(--hair);border-left:3px solid var(--gold);border-radius:8px}
  .banner .txt{font-size:14px;color:var(--t2)}
  .flash{display:flex;align-items:center;gap:11px;margin-bottom:22px;padding:14px 18px;background:var(--good-bg);border:1px solid var(--good-line);border-radius:8px;color:var(--ink);font-size:14px}

  /* Vehicle cards (portal + browse) */
  .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:22px}
  .mcard{background:var(--card);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s,transform .15s}
  .mcard:hover{border-color:var(--gold-line);transform:translateY(-2px)}
  .mphoto{position:relative;height:194px;flex:0 0 auto;background:#0B0D10;background-size:cover;background-position:center}
  .mphoto .grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0) 58%)}
  .pill{position:absolute;top:12px;display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.6);backdrop-filter:blur(3px);border-radius:5px;padding:5px 10px;font-size:11px;font-weight:600;color:#fff;letter-spacing:0.04em}
  .pill.lot{left:12px}
  .pill.str{right:12px}
  .pill.str .sd{width:7px;height:7px;border-radius:9999px;display:inline-block}
  .mphoto .ttl{position:absolute;left:14px;right:14px;bottom:12px;color:#fff;z-index:1}
  .mphoto .ttl .t{font-size:17px;font-weight:700;letter-spacing:-0.01em}
  .mphoto .ttl .a{font-size:11px;color:#E6E7E8;margin-top:3px}
  .mstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:16px}
  .mstats .s .k{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--faint)}
  .mstats .s .v{font-size:13px;font-weight:600;margin-top:5px;color:var(--ink)}
  .mstats .s.gold .v{color:var(--gold-txt)}
  .mland{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(202,163,76,0.07);border-top:1px solid var(--hair)}
  .mland .ml-k{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--gold-txt)}
  .mland .ml-v{font-size:16px;font-weight:700;color:var(--ink)}
  .mfoot{border-top:1px solid var(--hair);padding:14px 16px;display:flex;align-items:center;gap:10px}
  .mfoot .who{flex:1;min-width:0}
  .mfoot .who .n{font-size:13px;font-weight:600;color:var(--ink)}
  .mfoot .who .w{font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .why{padding:9px 16px 0;display:flex;gap:6px;flex-wrap:wrap}
  .why .wc{font-size:10.5px;font-weight:600;color:var(--gold-txt);background:var(--gold-tint);border:1px solid var(--gold-line);border-radius:9999px;padding:3px 9px}
  .why .wx{font-size:10.5px;font-weight:600;color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line);border-radius:9999px;padding:3px 9px}
  .specline{padding:2px 16px 0;font-size:11.5px;color:var(--t3);display:flex;gap:6px;flex-wrap:wrap}
  .specline b{color:var(--t2);font-weight:600}

  /* Wishlist rows (portal) */
  .wlrow{border:1px solid var(--hair);border-radius:var(--radius);margin-bottom:12px;overflow:hidden;background:var(--card)}
  .wlhead{display:flex;align-items:center;gap:12px;padding:15px 16px}
  .wlsum{flex:1;min-width:0}
  .wlsum .wln{font-size:14px;font-weight:600;color:var(--ink)}
  .wlsum .wlc{font-size:12.5px;color:var(--t3);margin-top:3px}
  .wlacts{display:flex;align-items:center;gap:8px}
  .wledit{border-top:1px solid var(--hair);background:var(--off)}
  .wledit summary{cursor:pointer;padding:12px 16px;font-size:13px;font-weight:600;color:var(--gold-txt);list-style:none}
  .wledit summary::-webkit-details-marker{display:none}
  .wledit summary:hover{background:rgba(255,255,255,0.03)}
  .wledit form{padding:6px 16px 18px}

  /* Sectioning + empties */
  .psec{margin:30px 0 16px}
  .psec h2{font-size:18px;font-weight:700;margin:0;color:var(--ink);letter-spacing:-0.01em}
  .psec .psub{margin:6px 0 0;font-size:13.5px;color:var(--t3);max-width:64ch}
  .empty{color:var(--faint);padding:34px 0;text-align:center}
  .empty .rule{width:42px;height:1px;background:var(--gold);opacity:.7;margin:0 auto 16px}
  .portal-acct{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .portal-acct .pa-k{font-size:12px;color:var(--t3)}
  .pwrap{display:flex;gap:9px;align-items:center;flex-wrap:wrap}

  /* Buyer portal: dashboard summary tiles (dark cloud-platform idiom, mono
     numerals to match the auction spec-sheet language used across the app). */
  .pstats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:4px 0 30px}
  .pstat{position:relative;background:linear-gradient(180deg,var(--card-2),var(--card));border:1px solid var(--hair);border-radius:12px;padding:18px 20px;overflow:hidden}
  .pstat:after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold);transform:scaleY(0);transform-origin:top;transition:transform .45s var(--ease,ease)}
  .pstat.lead:after{transform:scaleY(1)}
  .pstat .pk{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}
  .pstat .pv{font-family:var(--mono);font-size:30px;font-weight:700;color:var(--ink);margin-top:9px;line-height:1;letter-spacing:-0.01em}
  .pstat.lead .pv{color:var(--gold-txt)}
  .pstat .ps{font-size:12px;color:var(--t3);margin-top:7px;line-height:1.4}
  .psec h2 .ct{display:inline-block;vertical-align:middle;margin-left:9px;font-size:11px;font-weight:600;color:var(--gold-txt);background:var(--gold-tint);border:1px solid var(--gold-line);border-radius:9999px;padding:2px 9px;font-family:var(--mono);letter-spacing:0}
  @media(max-width:760px){.pstats{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:420px){.pstats{grid-template-columns:1fr}}

  /* Public request: success receipt + inline error */
  .reqok{border:1px solid var(--gold-line);border-left:4px solid var(--gold);background:linear-gradient(180deg,rgba(202,163,76,0.1),var(--card))}
  .reqok .reqok-badge{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-txt)}
  .reqok .reqok-badge .tick{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:var(--gold);color:#15120A;font-size:13px}
  .reqok .reqok-ref{margin-top:13px;font-size:15px;color:var(--ink)}
  .reqok .reqok-ref strong{font-weight:700;letter-spacing:.02em}
  .reqok p{margin:13px 0 0;color:var(--t2);font-size:14px;line-height:1.55}
  .reqerr{margin-bottom:18px;padding:13px 16px;background:var(--bad-bg);border:1px solid var(--bad-line);border-left:4px solid var(--bad);border-radius:8px;color:#F0A8B5;font-size:14px;line-height:1.45}
  .field-err{display:none;color:var(--bad);font-size:13px;line-height:1.45;margin-top:9px;font-weight:500}

  /* Login + set-password */
  .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(900px 520px at 50% -12%,rgba(202,163,76,0.13),transparent 60%),var(--bg);padding:24px;position:relative;overflow:hidden}
  .login-card:before{content:"";position:absolute;left:28px;right:28px;top:0;height:2px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .login-card{position:relative;z-index:1;width:100%;max-width:392px;background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:36px 32px 30px;box-shadow:var(--shadow)}
  .login-card .login-logo{display:flex;justify-content:center;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid var(--hair)}
  .login-card h1{font-size:22px;font-weight:700;margin:0 0 6px;text-align:center;letter-spacing:-0.01em}
  .login-card .login-sub{color:var(--t3);font-size:14px;text-align:center;margin:0 0 22px;line-height:1.45}
  .login-card label{margin-bottom:8px}
  .login-card .btn-gold{width:100%;margin-top:18px;padding:13px;font-size:15px}
  .login-err{background:var(--bad-bg);border:1px solid var(--bad-line);color:#F0A8B5;font-size:13px;padding:10px 12px;border-radius:8px;margin-bottom:16px;text-align:center}
  .login-note{font-size:12px;color:var(--t3);line-height:1.5;margin-top:7px;text-align:left}

  /* Pricing tiers */
  .pricegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
  .tier{position:relative;background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:26px 24px;display:flex;flex-direction:column}
  .tier.feature{border-color:var(--gold-line);box-shadow:0 0 0 1px var(--gold-line)}
  .tier .tier-tag{position:absolute;top:-11px;left:24px;background:var(--gold);color:#15120A;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:4px 11px;border-radius:9999px}
  .tier .tier-name{font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-txt)}
  .tier .tier-price{font-size:34px;font-weight:800;letter-spacing:-0.02em;margin:12px 0 2px}
  .tier .tier-price .per{font-size:14px;font-weight:500;color:var(--t3)}
  .tier .tier-sub{font-size:13px;color:var(--t3);margin-bottom:18px}
  .tier ul{list-style:none;margin:0 0 22px;padding:0;display:flex;flex-direction:column;gap:10px}
  .tier li{font-size:13.5px;color:var(--t2);display:flex;gap:9px;align-items:flex-start}
  .tier li:before{content:"";flex:0 0 auto;width:16px;height:16px;margin-top:1px;border-radius:9999px;background:var(--gold-tint);border:1px solid var(--gold-line);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2l2.2 2.3 4.8-5' stroke='%23E6C879' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:center}
  .tier .btn-gold,.tier .btn-dark{width:100%;margin-top:auto}

  /* Freemium gate */
  .gate{margin-top:22px;padding:22px 24px;text-align:center;background:linear-gradient(180deg,rgba(202,163,76,0.08),var(--card));border:1px dashed var(--gold-line);border-radius:var(--radius)}
  .gate .gn{font-size:18px;font-weight:700;color:var(--ink)}
  .gate .gs{font-size:13.5px;color:var(--t3);margin:7px 0 16px;max-width:46ch;margin-left:auto;margin-right:auto}

  /* CTA strip */
  .cta-import{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:16px 18px;background:rgba(202,163,76,0.08);border:1px solid var(--gold-line);border-radius:var(--radius)}
  .cta-import .ci-t{font-size:14px;font-weight:600;color:var(--ink)}
  .cta-import .ci-s{font-size:12.5px;color:var(--t3);margin-top:2px}

  /* Standalone info / 404 pages */
  .infowrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:24px;position:relative;overflow:hidden}
  .infocard{position:relative;z-index:1;width:100%;max-width:460px;background:var(--card);border:1px solid var(--hair);border-radius:14px;padding:38px 34px;text-align:center;box-shadow:var(--shadow)}
  .infocard .ico{display:flex;justify-content:center;margin-bottom:22px}
  .infocard h1{font-size:24px;margin:0 0 10px}
  .infocard p{color:var(--t2);font-size:15px;line-height:1.6;margin:0 0 22px}
  .infocard .ref{display:inline-block;font-weight:700;color:var(--gold-txt);letter-spacing:.02em}

  /* Mobile nav: a real button controls an off-canvas drawer. At phone widths
     the closed rail is visibility:hidden as well as translated, so its links
     cannot receive keyboard focus before the controller synchronises inert. */
  .nav-burger{display:none}
  .nav-close{display:none}
  .nav-scrim{display:none}
  @media(max-width:920px){
    .wrap{flex-direction:column}
    .nav-burger{display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:50;width:100%;height:52px;padding:0 16px;background:var(--bg-2);border:0;border-bottom:1px solid var(--hair);color:var(--ink);font-family:${FONT};font-weight:600;font-size:14px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    .nav-burger:focus-visible{outline:2px solid var(--gold);outline-offset:-3px}
    .nav-burger svg{width:22px;height:22px}
    .nav-close{display:flex;align-items:center;justify-content:center;position:absolute;top:12px;right:12px;z-index:2;width:44px;height:44px;border:1px solid var(--hair);border-radius:8px;background:var(--card);color:var(--ink);font:400 28px/1 ${FONT};cursor:pointer;touch-action:manipulation}
    .nav-close:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
    .side{position:fixed;top:0;left:0;height:100dvh;width:min(82vw,300px);transform:translateX(-100%);visibility:hidden;transition:transform .28s cubic-bezier(.2,.7,.3,1),visibility 0s linear .28s;z-index:60;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.55);overflow-y:auto;overscroll-behavior:contain}
    .nav{flex-direction:column}
    .side-foot{flex-direction:column;margin-top:auto;padding-top:20px}
    .side.is-open{transform:none;visibility:visible;transition-delay:0s}
    .nav-scrim{display:block;position:fixed;inset:0;width:100%;height:100%;padding:0;border:0;background:rgba(0,0,0,.55);opacity:0;visibility:hidden;transition:opacity .28s,visibility 0s linear .28s;z-index:55;cursor:pointer}
    .nav-scrim.is-open{opacity:1;visibility:visible;transition-delay:0s}
  }
  @media(prefers-reduced-motion:reduce){.side,.nav-scrim{transition:none!important}}
  @media(max-width:640px){
    .grid{grid-template-columns:1fr}
    /* Buyer garage + auction results: the minmax(320px) track overflowed a
       phone; force a single column so cards never bleed off-screen. */
    .mgrid{grid-template-columns:1fr}
    .wlhead{flex-wrap:wrap}
    .wlacts{width:100%;justify-content:flex-end}
    .btn-toggle,.btn-del{min-height:40px}
    .topbar,.content{padding-left:20px;padding-right:20px}
    .topbar{padding-top:24px;padding-bottom:22px}
    h1{font-size:28px}
    input,select,textarea{font-size:16px;min-height:48px}
    .actions{flex-wrap:wrap}
    .actions .btn-gold{width:100%;min-height:48px}
  }
`;

// Minimal escaper (mirrors render.esc) so this module has no import cycle with
// the app. Use for any caller-supplied text rendered into these pages.
export function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Analytics: Google Tag Manager + Meta (Facebook) Pixel, injected into every
// customer-facing page via brandDoc (marketing site, request form, login,
// set-password, info/404 and the buyer portal). The internal staff admin uses a
// separate shell() and is intentionally left untracked, so staff activity never
// pollutes ad audiences or conversion data.
const GTM_ID = "GTM-5QX9JQ4H";
const FB_PIXEL_ID = "438613762049767";
// Queue measurements immediately, but fetch the two third-party bundles only
// after the page load event. This preserves PageView/Lead events (the stubs
// queue them) without making either vendor compete with the LCP image.
const ANALYTICS_HEAD = `<script>(function(w){var n=w.navigator||{},c=n.connection||n.mozConnection||n.webkitConnection;w.__jdmAnalyticsDisabled=n.doNotTrack==='1'||w.doNotTrack==='1'||n.globalPrivacyControl===true||!!(c&&c.saveData);if(w.__jdmAnalyticsDisabled)return;w.dataLayer=w.dataLayer||[];w.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});if(!w.fbq){var q=w.fbq=function(){q.callMethod?q.callMethod.apply(q,arguments):q.queue.push(arguments)};q.queue=[];q.loaded=false;q.version='2.0';w._fbq=q;}w.fbq('init','${FB_PIXEL_ID}');w.fbq('track','PageView');})(window);</script>`;
const ANALYTICS_BODY = `<!-- Analytics fallbacks --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" title="" style="display:none;visibility:hidden"></iframe><img alt="" height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1"></noscript><script>(function(w,d){var done=false;function load(){if(done||w.__jdmAnalyticsDisabled)return;done=true;var first=d.scripts[0]||d.head.firstChild;var g=d.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtm.js?id=${GTM_ID}';first.parentNode.insertBefore(g,first);var m=d.createElement('script');m.async=true;m.src='https://connect.facebook.net/en_US/fbevents.js';first.parentNode.insertBefore(m,first);if(w.fbq)w.fbq.loaded=true;}if(d.readyState==='complete')setTimeout(load,0);else w.addEventListener('load',function(){setTimeout(load,0);},{once:true});})(window,document);</script>`;

// Floating "Chat with us on WhatsApp" button for customer-facing pages only
// (brandDoc - never the staff admin). The status dot/label is computed live in
// the browser against JDM Connect's business hours; outside hours it stays
// visible as "Away" so a lead can still leave a message 24/7. To change the
// number or hours, edit these constants.
const WA_NUMBER = "61415111221";      // +61 415 111 221, digits only for wa.me
const WA_OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // 0=Sun … 6=Sat → Mon-Sat
const WA_OPEN_START = 9;               // 9am
const WA_OPEN_END = 17;                // 5pm (exclusive)
const WA_TZ = "Australia/Perth";       // AWST
const WA_PREFILL = "Hi JDM Connect, I'd like to ask about importing a car.";
const WA_ICON = `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 .4C7.4.4.5 7.3.5 15.9c0 2.8.7 5.5 2.1 7.9L.4 31.6l8-2.1c2.3 1.3 4.9 1.9 7.6 1.9 8.6 0 15.5-6.9 15.5-15.5S24.6.4 16 .4zm0 28.3c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.8 1.3 1.3-4.6-.3-.5c-1.3-2.1-2-4.5-2-7 0-7.2 5.8-13 13-13s13 5.8 13 13-5.8 13-13 13zm7.1-9.7c-.4-.2-2.3-1.1-2.6-1.3-.3-.1-.6-.2-.8.2-.2.4-.9 1.3-1.1 1.5-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.1-2.7-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.6.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7-.1-.2-.8-2-1.1-2.7-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.2 3.3 1.4 3.6.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.6.2-1.8-.1-.1-.3-.2-.7-.4z"/></svg>`;
const CONTACT_WIDGET = `<a id="waFab" class="wa-fab" href="https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_PREFILL)}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp"><span class="wa-ic">${WA_ICON}</span><span class="wa-tx"><span class="wa-t1">Chat with us</span><span class="wa-t2" id="waStatus">WhatsApp us</span></span><span class="wa-dot" id="waDot" aria-hidden="true"></span></a>
<style>.wa-fab{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:9998;touch-action:manipulation;display:flex;align-items:center;gap:11px;padding:11px 16px 11px 12px;background:#25D366;color:#0b1f14;border-radius:999px;text-decoration:none;box-shadow:0 10px 28px rgba(0,0,0,.28);font-family:Inter,system-ui,-apple-system,sans-serif;transition:transform .16s ease,box-shadow .16s ease}.wa-fab:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.34)}.wa-fab:focus-visible{outline:3px solid #fff;outline-offset:3px}.wa-fab:active{transform:translateY(0)}.wa-ic{display:flex;align-items:center;justify-content:center;width:30px;height:30px}.wa-ic svg{width:26px;height:26px}.wa-tx{display:flex;flex-direction:column;line-height:1.15}.wa-t1{font-weight:700;font-size:14px}.wa-t2{font-size:11.5px;opacity:.82;font-weight:500}.wa-dot{width:9px;height:9px;border-radius:50%;background:#9aa3a0;margin-left:2px;box-shadow:0 0 0 3px rgba(255,255,255,.35)}.wa-fab.is-online .wa-dot{background:#0a3;box-shadow:0 0 0 3px rgba(0,190,75,.3)}@media(max-width:560px){.wa-fab .wa-tx{display:none}.wa-fab{padding:13px;gap:0}.request-page .wa-fab{bottom:calc(96px + env(safe-area-inset-bottom))}.wa-ic{width:26px;height:26px}}@media(prefers-reduced-motion:reduce){.wa-fab{transition:none}}</style>
<script>(function(){var fab=document.getElementById('waFab');if(!fab)return;var st=document.getElementById('waStatus');var days=[${WA_OPEN_DAYS.join(",")}],sH=${WA_OPEN_START},eH=${WA_OPEN_END},tz=${JSON.stringify(WA_TZ)};function parts(){try{var f=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'numeric',hour12:false});var wd='',hr=0;f.formatToParts(new Date()).forEach(function(p){if(p.type==='weekday')wd=p.value;if(p.type==='hour')hr=parseInt(p.value,10);});if(hr===24)hr=0;var m={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return{day:m[wd],hour:hr};}catch(e){return null;}}function isOpen(){var p=parts();if(!p)return true;return days.indexOf(p.day)>=0&&p.hour>=sH&&p.hour<eH;}function apply(){var on=isOpen();fab.classList.toggle('is-online',on);if(st)st.textContent=on?"We're online now":"Away - leave a message";}apply();setInterval(apply,60000);})();</script>`;

// Full branded HTML document for standalone (no sidebar) pages: login,
// set-password, info, 404. `bodyInner` is the inner markup; the doc supplies the
// dark stylesheet and a head. GTM goes as high as possible in <head>; both
// noscript fallbacks go immediately after <body> opens.
// opts.analytics gates GTM + Meta Pixel injection. It defaults to OFF so
// authenticated/credential pages (login, set-password, the buyer portal) never
// load third-party scripts that would get full DOM access to a signed-in
// buyer's matches, PII and Stripe checkout context (audit Medium #15). Only the
// public marketing surfaces (landing, request form + its confirmation, info /
// 404, public lot share) opt in with { analytics: true }.
export function brandDoc(bodyInner, title = "JDM Connect", opts = {}) {
  const head = opts.analytics ? ANALYTICS_HEAD : "";
  const analytics = opts.analytics ? ANALYTICS_BODY : "";
  const content = /\bid=["']main["']/.test(bodyInner)
    ? bodyInner
    : `<main id="main">${bodyInner}</main>`;
  const description = String(opts.description || "").trim();
  const canonical = String(opts.canonical || "").trim();
  const ogTitle = String(opts.ogTitle || title).trim();
  const ogDescription = String(opts.ogDescription || description).trim();
  const ogUrl = String(opts.ogUrl || canonical).trim();
  const social = description
    ? `<meta name="description" content="${escHtml(description)}"><meta property="og:title" content="${escHtml(ogTitle)}"><meta property="og:description" content="${escHtml(ogDescription)}"><meta property="og:type" content="${escHtml(opts.ogType || "website")}">${ogUrl ? `<meta property="og:url" content="${escHtml(ogUrl)}">` : ""}${opts.ogImage ? `<meta property="og:image" content="${escHtml(opts.ogImage)}">` : ""}`
    : "";
  const canonicalTag = canonical ? `<link rel="canonical" href="${escHtml(canonical)}">` : "";
  const preload = opts.preloadImage
    ? `<link rel="preload" as="image" href="${escHtml(opts.preloadImage.href || "")}"${opts.preloadImage.srcset ? ` imagesrcset="${escHtml(opts.preloadImage.srcset)}"` : ""}${opts.preloadImage.sizes ? ` imagesizes="${escHtml(opts.preloadImage.sizes)}"` : ""}>`
    : "";
  const bodyClass = String(opts.bodyClass || "").split(/\s+/).filter((x) => /^[a-zA-Z0-9_-]+$/.test(x)).join(" ");
  const fontUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap";
  const font = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="${fontUrl}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${fontUrl}"></noscript>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0F1115">${head}<meta name="color-scheme" content="dark"><title>${escHtml(title)}</title>${social}${canonicalTag}${preload}${font}<style>${themeCss}</style></head><body${bodyClass ? ` class="${bodyClass}"` : ""}><a class="skip-link" href="#main">Skip to content</a>${content}${CONTACT_WIDGET}${analytics}</body></html>`;
}

// Branded sidebar + main shell (buyer portal). Mirrors the staff shell signature
// so portal markup can move over without restructuring. Analytics stays OFF by
// default (the portal is authenticated); public callers pass { analytics: true }.
export function brandShell(side, main, title = "JDM Connect", opts = {}) {
  const existingId = side.match(/<aside\b[^>]*\bid=["']([a-zA-Z][\w-]*)["']/i)?.[1];
  const navId = existingId || "portalNav";
  let mobileSide = existingId ? side : side.replace(/<aside\b/i, `<aside id="${navId}"`);
  mobileSide = mobileSide.replace(/(<aside\b[^>]*>)/i, `$1<button class="nav-close" type="button" aria-label="Close menu"><span aria-hidden="true">&times;</span></button>`);
  const shellScript = `<script>(function(){var b=document.querySelector('.nav-burger'),n=document.getElementById(${JSON.stringify(navId)}),s=document.querySelector('.nav-scrim'),x=n&&n.querySelector('.nav-close'),m=document.querySelector('.main'),mq=window.matchMedia&&window.matchMedia('(max-width:920px)');if(!b||!n||!s)return;var open=false;function focusables(){return [].slice.call(n.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function(el){return !el.hidden;});}function apply(next,restore){open=!!next&&!!(mq&&mq.matches);n.classList.toggle('is-open',open);s.classList.toggle('is-open',open);b.setAttribute('aria-expanded',open?'true':'false');s.setAttribute('aria-hidden',open?'false':'true');if(m)m.inert=open;if(mq&&mq.matches){n.inert=!open;n.setAttribute('aria-hidden',open?'false':'true');}else{n.inert=false;n.removeAttribute('aria-hidden');}if(open){var f=focusables()[0];if(f)f.focus();}else if(restore){b.focus();}}b.addEventListener('click',function(){apply(!open,false);});s.addEventListener('click',function(){apply(false,true);});if(x)x.addEventListener('click',function(){apply(false,true);});n.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('a[href]'))apply(false,false);});document.addEventListener('keydown',function(e){if(!open)return;if(e.key==='Escape'){e.preventDefault();apply(false,true);return;}if(e.key==='Tab'){var fs=focusables();if(!fs.length)return;var first=fs[0],last=fs[fs.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});if(mq){if(mq.addEventListener)mq.addEventListener('change',function(){apply(false,false);});else if(mq.addListener)mq.addListener(function(){apply(false,false);});}apply(false,false);})();</script>`;
  return brandDoc(
    `<div class="wrap">${mobileSide}<button type="button" class="nav-scrim" aria-label="Close menu" aria-hidden="true" tabindex="-1"></button><div class="main" id="main" role="main"><button type="button" class="nav-burger" aria-label="Open menu" aria-controls="${navId}" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></button>${main}</div></div>${shellScript}`,
    title,
    opts
  );
}

const LEGAL_STYLE = `<style>
  .legal{max-width:760px;margin:0 auto;padding:48px 22px 90px;color:var(--ink)}
  .lg-back{display:inline-block;color:var(--gold-txt);font-weight:600;text-decoration:none;font-size:14px;margin-bottom:26px}
  .legal h1{font-size:clamp(30px,6vw,44px);font-weight:700;letter-spacing:-.02em;margin:0 0 8px}
  .lg-updated{color:var(--faint);font-size:13px;margin:0 0 26px}
  .lg-lead{font-size:17px;line-height:1.6;color:var(--t2);margin:0 0 12px}
  .lg-s{padding:22px 0;border-top:1px solid var(--hair)}
  .lg-s h2{font-size:19px;font-weight:700;margin:0 0 12px}
  .legal p{font-size:15px;line-height:1.65;color:var(--t2);margin:0 0 12px}
  .legal ul{margin:0 0 12px;padding-left:20px;display:flex;flex-direction:column;gap:8px}
  .legal li{font-size:15px;line-height:1.6;color:var(--t2)}
  .legal strong{color:var(--ink)}
  .legal a{color:var(--gold-txt)}
  .legal a:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  .lg-cta{display:inline-block;margin-top:30px}
</style>`;

// Public privacy policy (Australian Privacy Act, APP 5 collection notice + how
// data is handled). Linked from every email footer and the request form. The
// business should have this reviewed by their own adviser; it is written to be
// accurate to how the app actually handles data today.
export function privacyPage() {
  const updated = "13 July 2026";
  const s = (h, body) => `<section class="lg-s"><h2>${h}</h2>${body}</section>`;
  const inner = `<div class="legal">
    <a class="lg-back" href="/">&larr; JDM Connect</a>
    <h1>Privacy Policy</h1>
    <p class="lg-updated">Last updated: ${updated}</p>
    <p class="lg-lead">JDM Connect ("we", "us", "our") runs the JDM Finder vehicle-sourcing
      service at jdmfinder.com.au. This policy explains what personal information we collect,
      why, who we share it with, and your rights under the Australian <em>Privacy Act 1988</em>
      and the Australian Privacy Principles (APPs).</p>

    ${s("Who we are", `<p>JDM Connect, Japanese vehicle imports, Australia-wide.
      Questions about privacy or your data: <a href="mailto:jate@jdmconnect.com.au">jate@jdmconnect.com.au</a>.</p>`)}

    ${s("What we collect", `<ul>
      <li><strong>Contact details</strong> you give us: name, email, phone/WhatsApp, and your state or delivery country.</li>
      <li><strong>Your vehicle search</strong>: the makes, models, years, budget and preferences you ask us to find.</li>
      <li><strong>Account &amp; activity</strong>: if you use the buyer portal, a login and a record of the vehicles we send you and whether you have viewed them, so we can follow up.</li>
      <li><strong>Payment records</strong>: when you pay a deposit or membership, our payment processor handles your card details; we keep a record of the transaction (amount, date, reference), not your full card number.</li>
    </ul>`)}

    ${s("Why we collect it", `<p>To search Japanese auctions for the vehicle you want, contact you about matches,
      arrange purchase, import and delivery, take payments, and provide the buyer portal. We only use your
      details for the service you asked for.</p>`)}

    ${s("Who we share it with", `<p>We do not sell your personal information. We share it only with the
      service providers we need to run the service, who act on our instructions:</p>
      <ul>
        <li><strong>Cloudflare</strong> - hosting, security and our database.</li>
        <li><strong>Stripe</strong> - payment processing (deposits and membership).</li>
        <li><strong>Resend</strong> - sending you email.</li>
        <li><strong>Google</strong> - only if you choose "Continue with Google" to sign in.</li>
        <li><strong>Meta or Twilio</strong> - if WhatsApp delivery is enabled, to deliver the messages you ask us to send about your search.</li>
        <li><strong>ntfy or Pushover</strong> - if enabled, to alert our team about a new enquiry or payment so we can respond promptly.</li>
        <li><strong>Our auction-data provider</strong> - to retrieve vehicle and auction information. We do not send it your account password or payment-card details.</li>
        <li>Our <strong>auction agents in Japan</strong> - to source and bid on the vehicle you request.</li>
      </ul>
      <p>Some of these providers store data outside Australia (for example, the United States). By using the
      service you consent to that overseas disclosure for these purposes.</p>`)}

    ${s("Analytics and cookies", `<p>Our public pages (the landing page and the request form) use Google
      Tag Manager and the Meta (Facebook) Pixel to understand how people find and use the site. These are
      <strong>not</strong> loaded on the signed-in buyer portal or the login pages. You can block cookies in
      your browser or use tracking-protection tools.</p>`)}

    ${s("How we store and protect it", `<p>Data is stored in Cloudflare's encrypted database. Access is
      restricted to JDM Connect staff. Passwords are hashed, never stored in plain text, and connections use HTTPS.</p>`)}

    ${s("Keeping and deleting it", `<p>We keep your information only as long as we need it for the purposes
      above or to meet legal/financial-record obligations. Ask us and we will delete your personal information
      when it is no longer needed.</p>`)}

    ${s("Marketing and opt-out", `<p>We only email you about your own search and vehicles we think match it.
      Every email includes an unsubscribe option; you can also opt out any time by emailing
      <a href="mailto:jate@jdmconnect.com.au?subject=Unsubscribe">jate@jdmconnect.com.au</a> with "Unsubscribe"
      in the subject.</p>`)}

    ${s("Access, correction and complaints", `<p>You can ask us for a copy of the personal information we hold
      about you, ask us to correct it, or make a privacy complaint, by emailing
      <a href="mailto:jate@jdmconnect.com.au">jate@jdmconnect.com.au</a>. If you are not satisfied with our
      response, you can contact the Office of the Australian Information Commissioner (OAIC) at
      <a href="https://www.oaic.gov.au" target="_blank" rel="noopener">oaic.gov.au</a>.</p>`)}

    ${s("Changes to this policy", `<p>We may update this policy from time to time. The "last updated" date
      above shows when it last changed.</p>`)}

    <a class="btn-gold lg-cta" href="/request">Start a vehicle request</a>
  </div>${LEGAL_STYLE}`;
  // Public page: keep analytics OFF here (a privacy page loading trackers is a
  // bad look, and it is not part of the conversion funnel).
  return brandDoc(inner, "Privacy Policy - JDM Connect", {
    description: "How JDM Connect collects, uses, stores and shares information when you use JDM Finder.",
    canonical: "https://jdmfinder.com.au/privacy",
  });
}

// Plain-English customer terms for the public Finder and optional membership.
// Transaction-specific vehicle purchase/import agreements still govern an
// actual purchase; these terms describe browsing, requests and membership.
export function termsPage() {
  const updated = "13 July 2026";
  const s = (h, body) => `<section class="lg-s"><h2>${h}</h2>${body}</section>`;
  const inner = `<div class="legal">
    <a class="lg-back" href="/">&larr; JDM Connect</a>
    <h1>Customer Terms</h1>
    <p class="lg-updated">Last updated: ${updated}</p>
    <p class="lg-lead">These terms cover JDM Finder vehicle searches and the optional monthly membership offered by JDM Connect. They do not replace the separate written quote or agreement you receive before we buy, import or deliver a vehicle for you.</p>

    ${s("Using JDM Finder", `<p>You must provide accurate contact and vehicle-search details and use the service lawfully. Auction listings, translations, eligibility indicators, sold prices and landed-cost figures are guides only. Vehicle condition, build date, import eligibility, exchange rates and final costs must be confirmed before you commit.</p>`)}

    ${s("Free searches", `<p>A free request lets our team review your criteria and share suitable examples when available. It does not guarantee that a matching car will be listed, that we will bid, or that a vehicle can be imported. A button asking us to chase a lot sends a request to our team; it is not a bid or purchase instruction.</p>`)}

    ${s("Membership", `<p>Membership renews monthly at the price shown before checkout. It gives the account holder access to the member features shown on the site while the subscription remains active. You can cancel future renewals at any time from the billing portal. Cancellation takes effect at the end of the paid billing period unless we state otherwise.</p>`)}

    ${s("Credits, cancellation and refunds", `<p>If the membership offer says eligible payments can be credited toward a later JDM Connect import fee, the displayed limit and conditions apply. Except where Australian Consumer Law requires a refund or another remedy, a change of mind does not automatically refund a membership period already supplied. If a feature was not provided as described, contact us and we will assess a refund or other remedy promptly. Cancelling stops future renewal charges.</p>`)}

    ${s("Vehicle transactions", `<p>Do not treat a listing, estimate or request confirmation as a binding offer to buy a vehicle. Before any bid or purchase, JDM Connect will confirm the vehicle, authority, fees, deposit and transaction terms with you. Auction deposits and import-service payments are handled under that transaction's written terms and Australian Consumer Law.</p>`)}

    ${s("Availability and accounts", `<p>We may pause the service for maintenance, provider outages, safety or misuse. Keep your sign-in details private and tell us promptly if you believe someone else has used your account. We may restrict an account that is used unlawfully or to interfere with the service.</p>`)}

    ${s("Contact", `<p>Questions, cancellations or refund requests: <a href="mailto:jate@jdmconnect.com.au">jate@jdmconnect.com.au</a>. JDM Connect is based in Perth, Western Australia and serves customers Australia-wide. See our <a href="/privacy">Privacy Policy</a> for how we handle personal information.</p>`)}

    <a class="btn-gold lg-cta" href="/request">Start a vehicle request</a>
  </div>${LEGAL_STYLE}`;
  return brandDoc(inner, "Customer Terms - JDM Connect", {
    description: "Terms for JDM Finder vehicle searches, memberships, cancellations, credits and refunds.",
    canonical: "https://jdmfinder.com.au/terms",
  });
}

// Branded "not found" page. Replaces the bare text 404.
export function notFoundPage() {
  const inner = `<div class="infowrap">
    ${risingSun({ size: 460, tone: "faint" })}
    <div class="infocard">
      <div class="ico">${LOGO}</div>
      <h1>Page not found</h1>
      <p>We could not find that page. The link may be old or mistyped.</p>
      <a class="btn-gold" href="/request">Start a vehicle request</a>
    </div>
  </div>`;
  return brandDoc(inner, "Not found - JDM Connect");
}

// Branded single-message page (used for the email approve / skip confirmations
// and other simple outcomes). `opts.cta` is an optional { href, label }.
export function infoPage(title, message, opts = {}) {
  const cta = opts.cta
    ? `<a class="btn-gold" href="${escHtml(opts.cta.href)}">${escHtml(opts.cta.label)}</a>`
    : `<a class="btn-dark" href="/request">Back to JDM Connect</a>`;
  const inner = `<div class="infowrap">
    ${risingSun({ size: 460, tone: "faint" })}
    <div class="infocard">
      <div class="ico">${LOGO}</div>
      <h1>${escHtml(title)}</h1>
      <p>${opts.html ? message : escHtml(message)}</p>
      ${cta}
    </div>
  </div>`;
  return brandDoc(inner, escHtml(title) + " - JDM Connect");
}

// Confirmation page for an emailed approve/skip link. The email links here with
// a GET (safe: an email scanner or link-prefetcher renders this page but never
// submits the form); the visible button POSTs to /decide to actually apply the
// decision. `token` is the queue row's capability token, so no login is needed.
export function decisionConfirmPage(token, action, ret) {
  const isApprove = action === "approve";
  const title = isApprove ? "Approve this match?" : "Skip this match?";
  const desc = isApprove
    ? "This sends the vehicle to the client and marks the match handled."
    : "This removes the match from your review queue. The client is not contacted.";
  const label = isApprove ? "Approve and send" : "Skip this match";
  const cls = isApprove ? "btn-gold" : "btn-dark";
  const retField = ret && String(ret).startsWith("/admin")
    ? `<input type="hidden" name="return" value="${escHtml(ret)}">` : "";
  const inner = `<div class="infowrap">
    ${risingSun({ size: 460, tone: "faint" })}
    <div class="infocard">
      <div class="ico">${LOGO}</div>
      <h1>${escHtml(title)}</h1>
      <p>${escHtml(desc)}</p>
      <form method="POST" action="/decide" style="display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:4px">
        <input type="hidden" name="token" value="${escHtml(token)}">
        <input type="hidden" name="action" value="${escHtml(action)}">
        ${retField}
        <button class="${cls}" type="submit">${escHtml(label)}</button>
      </form>
    </div>
  </div>`;
  return brandDoc(inner, escHtml(title) + " - JDM Connect");
}
