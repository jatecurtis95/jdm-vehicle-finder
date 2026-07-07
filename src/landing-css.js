// Landing-only stylesheet for the JDMFinder marketing page, rebuilt to the v2
// design handoff. Scoped under `.jf` so none of these marketing classes leak
// onto the admin or buyer-portal pages (which use theme.js / shell()).
//
// v2 direction: dark, premium, editorial. Inter for EVERYTHING visible (display
// + body); a system monospace stack for eyebrows, labels, specs and the ticker.
// Bodoni was removed in v2, so this page no longer loads any display web font;
// brandDoc already serves Inter. Gold (#CAA34C / #E6C879) is the only accent,
// used for a rule, a label, or a single number, never a flood fill. Motion is
// restrained and mechanical (one easing curve, no bounces, no hover scale jumps
// except the lineup card's deliberate 5px lift).
export const landingCss = `
  .jf{
    /* v2 palette, local so the darker marketing bg never fights theme's --bg. */
    --jf-bg:#07090C;--jf-bg2:#0A0C10;--jf-bg3:#0A0C0F;--jf-card:#10131A;--jf-sheet:#0B0E12;
    --jf-ink:#F4F2EC;--jf-t2:#C9CCD1;--jf-t3:#9BA0A7;--jf-faint:#888D95;--jf-faint2:#6E737B;
    --gold:#CAA34C;--gold-2:#E6C879;--gold-hover:#D9B45F;--gold-cream:#9A7B2B;
    --gold-line:rgba(202,163,76,0.5);--gold-line-2:rgba(202,163,76,0.22);--gold-tint:rgba(202,163,76,0.06);
    --green:#5BC08C;--green-bg:rgba(91,192,140,0.13);--green-line:rgba(91,192,140,0.4);
    --red:#C61F2F;--red-mark:#D8434F;--red-dot:#B11226;
    --cream:#f3f2ee;--cream-card:#ffffff;--cream-ink:#1b1c1e;--cream-t2:#5b606a;
    --cream-hair:rgba(27,28,30,0.18);--cream-hair-2:rgba(27,28,30,0.12);
    --hair:rgba(255,255,255,0.09);--hair-2:rgba(255,255,255,0.06);--hair-3:rgba(255,255,255,0.14);
    --mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace;
    --ease:cubic-bezier(0.2,0.8,0.2,1);
    position:relative;background:var(--jf-bg);color:var(--jf-ink);overflow-x:clip;
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .jf ::selection{background:var(--gold);color:#15120A}
  .jf a{text-decoration:none;color:inherit}
  .jf img{display:block;max-width:100%}
  .jf h1,.jf h2,.jf h3{margin:0}
  .jf a:focus-visible,.jf summary:focus-visible,.jf button:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:8px}

  /* ===== Buttons (Inter, never a serif). Gold primary, ghost dark, ghost cream. */
  .jf-gold{display:inline-flex;align-items:center;gap:9px;background:var(--gold);color:#15120A;
    font-size:15px;font-weight:600;padding:16px 28px;border-radius:8px;transition:background .2s var(--ease),transform .05s}
  .jf-gold:hover{background:var(--gold-hover)}
  .jf-gold:active{transform:translateY(1px)}
  .jf-dark{display:inline-flex;align-items:center;gap:9px;background:rgba(255,255,255,0.05);color:var(--jf-t2);
    border:1px solid rgba(255,255,255,0.16);font-size:15px;font-weight:600;padding:16px 28px;border-radius:8px;
    transition:border-color .2s,color .2s}
  .jf-dark:hover{border-color:var(--gold-line);color:var(--jf-ink)}
  .jf-cream{display:inline-flex;align-items:center;gap:9px;background:transparent;color:var(--cream-ink);
    border:1px solid var(--cream-hair);font-size:15px;font-weight:600;padding:15px 26px;border-radius:8px;transition:border-color .2s}
  .jf-cream:hover{border-color:rgba(27,28,30,0.55)}
  .ar{font-size:16px;line-height:1}

  /* ===== Eyebrow: short gold rule + mono uppercase label. */
  .eb{display:flex;align-items:center;gap:13px;margin-bottom:30px}
  .eb .r{width:30px;height:1px;background:var(--gold);flex:none}
  .eb .t{font-family:var(--mono);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold-2);white-space:nowrap}
  .lp-cream .eb .t{color:var(--gold-cream)}

  .mono{font-family:var(--mono)}
  .sec{padding:140px 40px}
  .sec-in{max-width:1340px;margin:0 auto}

  /* ===== NAV: transparent over hero, solid after scroll (data-scrolled). ===== */
  .jf-nav{position:sticky;top:0;z-index:60;background:rgba(7,9,12,0.04);border-bottom:1px solid rgba(255,255,255,0);
    transition:background .3s ease,border-color .3s ease}
  .jf-nav[data-scrolled]{background:rgba(7,9,12,0.92);border-bottom-color:rgba(255,255,255,0.1);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  .jf-nav-in{max-width:1340px;margin:0 auto;padding:22px 40px;display:flex;align-items:center;justify-content:space-between;gap:24px}
  .jf-nav[data-scrolled] .jf-nav-in{padding-top:12px;padding-bottom:12px}
  .jf-brand{display:flex;align-items:center;gap:13px}
  .jf-brand svg{height:18px;width:auto}
  .jf-brand svg path,.jf-brand svg polygon{fill:var(--jf-ink)}
  .jf-tag{font-family:var(--mono);font-size:10px;letter-spacing:0.3em;color:var(--jf-t3);text-transform:uppercase;
    border-left:1px solid rgba(255,255,255,0.2);padding-left:13px}
  .jf-nav-right{display:flex;align-items:center;gap:30px}
  .jf-nav-links{display:flex;align-items:center;gap:28px}
  .jf-nav-links a{font-size:14px;color:var(--jf-t2);transition:color .2s}
  .jf-nav-links a:hover{color:var(--jf-ink)}
  .jf-nav .jf-gold{padding:11px 20px;font-size:14px}
  .nav-burger{display:none;width:42px;height:42px;flex-direction:column;align-items:center;justify-content:center;gap:5px;
    background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.16);border-radius:8px;cursor:pointer;flex:none}
  .nav-burger span{width:17px;height:1.5px;background:#C9CCD1;display:block}
  .nav-menu{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:2px;
    background:rgba(7,9,12,0.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.1);padding:10px 22px 20px}
  .nav-menu a{font-size:16px;color:var(--jf-t2);padding:14px 4px;border-bottom:1px solid var(--hair-2)}
  .nav-menu a:last-child{border-bottom:0}
  /* Sticky-nav offset so in-page anchors don't hide under the fixed header. */
  .jf :is(#lineup,#cost,#how,#membership,#trust,#features,#start,#top){scroll-margin-top:90px}

  /* Photo wrappers carry a deep fallback so a slow or failed image never flashes. */
  .hero-bg,.feat-bg,.moment-bg,.cost-bg,.divlab-bg,.final-bg{background:#0b0d10}

  /* ===== HERO ===== */
  .hero{position:relative;min-height:100vh;background:var(--jf-bg);overflow:hidden;display:flex;flex-direction:column}
  .hero-bg{position:absolute;inset:0;z-index:1}
  .hero-bg img{width:100%;height:100%;object-fit:cover;object-position:62% 50%;filter:brightness(0.82) contrast(1.04) saturate(0.86);transform:scale(1.16);will-change:transform}
  .hero-bg .scrim{position:absolute;inset:0;background:
    linear-gradient(96deg,var(--jf-bg) 0%,rgba(7,9,12,0.9) 30%,rgba(7,9,12,0.42) 58%,rgba(7,9,12,0.12) 100%),
    linear-gradient(0deg,var(--jf-bg) 0%,rgba(7,9,12,0.16) 30%,rgba(7,9,12,0) 60%)}
  /* Atmospheric placeholder shown wherever a licensed photo has not been dropped in yet. */
  .ph{position:absolute;inset:0;overflow:hidden;background:
    radial-gradient(900px 520px at 78% 18%,rgba(202,163,76,0.16),transparent 60%),
    radial-gradient(700px 600px at 28% 82%,rgba(202,163,76,0.05),transparent 55%),
    linear-gradient(180deg,#14171c,#0b0d10)}
  .ph:before{content:"";position:absolute;inset:0;opacity:.5;
    background:linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px);
    background-size:46px 46px;-webkit-mask-image:radial-gradient(70% 70% at 60% 40%,#000,transparent);mask-image:radial-gradient(70% 70% at 60% 40%,#000,transparent)}
  .ph-tag{position:absolute;left:18px;bottom:16px;z-index:2;font-family:var(--mono);font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--jf-faint)}

  .hero-wrap{position:relative;z-index:3;flex:1;display:flex;align-items:center;max-width:1340px;width:100%;margin:0 auto;padding:120px 40px 150px}
  .hero-copy{max-width:740px}
  .hero h1{font-weight:800;font-size:clamp(46px,6.6vw,98px);line-height:0.98;letter-spacing:-0.018em;color:var(--jf-ink);text-wrap:balance}
  .hero h1 em{font-style:italic;font-weight:700;color:var(--gold-2)}
  .hero-sub{margin-top:30px;max-width:540px;font-size:18px;line-height:1.62;color:var(--jf-t2)}
  .hero-btns{display:flex;flex-wrap:wrap;gap:14px;margin-top:38px}
  .hero-fine{margin-top:30px;font-family:var(--mono);font-size:11px;letter-spacing:0.14em;color:var(--jf-faint);text-transform:uppercase}

  .scroll-cue{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);z-index:4;display:flex;flex-direction:column;align-items:center;gap:12px}
  .scroll-cue span.l{font-family:var(--mono);font-size:9px;letter-spacing:0.26em;color:var(--jf-t3);text-transform:uppercase}
  .scroll-cue span.b{width:1px;height:46px;background:linear-gradient(var(--gold),rgba(202,163,76,0));animation:jfScroll 2.4s var(--ease) infinite}

  .ticker{position:absolute;bottom:0;left:0;right:0;z-index:5;border-top:1px solid var(--hair-2);
    background:rgba(7,9,12,0.66);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);overflow:hidden;padding:13px 0}
  .ticker-row{display:flex;width:max-content;animation:jfTicker 46s linear infinite;
    font-family:var(--mono);font-size:11px;letter-spacing:0.1em;color:var(--jf-faint);text-transform:uppercase;white-space:pre}

  /* ===== FEATURE PIN (300vh) ===== */
  .feat{position:relative;background:var(--jf-bg)}
  .feat-pin{position:relative;height:300vh}
  .feat-stage{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .feat-bg{position:absolute;inset:0;z-index:0}
  .feat-bg img{width:100%;height:100%;object-fit:cover;object-position:50% 42%;filter:brightness(0.46) contrast(1.06) saturate(0.8);transform:scale(1.04);will-change:transform}
  .feat-bg .scrim{position:absolute;inset:0;background:radial-gradient(120% 92% at 50% 50%,rgba(7,9,12,0.32),rgba(7,9,12,0.92))}
  .feat-in{position:relative;z-index:1;max-width:1040px;width:100%;margin:0 auto;padding:0 40px;text-align:center}
  .feat-eb{font-family:var(--mono);font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:var(--gold-2)}
  .feat-deck{position:relative;min-height:320px;margin-top:34px}
  .feat-callout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;opacity:0;
    transform:translateY(28px) scale(0.99);transition:opacity .6s var(--ease),transform .6s var(--ease)}
  .feat-callout.show{opacity:1;transform:none}
  .feat-callout .k{font-family:var(--mono);font-size:12px;letter-spacing:0.2em;color:var(--jf-t3);margin-bottom:22px}
  .feat-callout h2{font-weight:700;font-size:clamp(36px,5.4vw,78px);line-height:0.99;letter-spacing:-0.018em;color:var(--jf-ink);max-width:15ch;text-wrap:balance}
  .feat-callout p{margin-top:26px;max-width:520px;font-size:18px;line-height:1.6;color:var(--jf-t2)}
  .feat-dots{display:flex;gap:9px;justify-content:center;margin-top:58px}
  .feat-dots span{width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,0.22);transform-origin:left;transition:background .3s ease,transform .3s ease}

  /* ===== PHOTO MOMENT (problem / culture) ===== */
  .moment{position:relative;min-height:96vh;background:var(--jf-bg);overflow:hidden;display:flex;align-items:center}
  .moment-bg{position:absolute;inset:0;z-index:1}
  .moment-bg img{width:100%;height:100%;object-fit:cover;object-position:70% 50%;filter:brightness(0.72) contrast(1.05) saturate(0.9)}
  .moment-bg.bw img{filter:brightness(0.72) contrast(1.08) saturate(0)}
  .moment-bg .scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--jf-bg) 0%,rgba(7,9,12,0.86) 40%,rgba(7,9,12,0.2) 100%)}
  .moment-in{position:relative;z-index:2;max-width:1340px;width:100%;margin:0 auto;padding:120px 40px}
  .moment-in .box{max-width:760px}
  .moment h2{font-weight:700;font-size:clamp(34px,5vw,72px);line-height:1.02;letter-spacing:-0.016em;color:var(--jf-ink);text-wrap:balance}
  .moment h2 .g{color:var(--gold-2)}
  .moment p{margin-top:30px;max-width:540px;font-size:19px;line-height:1.6;color:var(--jf-t2)}

  /* ===== HOW IT WORKS (cream) ===== */
  .lp-cream{background:var(--cream);color:var(--cream-ink)}
  .how h2{font-weight:700;font-size:clamp(34px,4.6vw,64px);line-height:1.0;letter-spacing:-0.016em;max-width:880px;margin-bottom:70px;text-wrap:balance}
  .steps{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--cream-hair)}
  .step{padding:34px 30px 8px;border-right:1px solid var(--cream-hair-2)}
  .step:last-child{border-right:0}
  .step .sn{font-family:var(--mono);font-size:12px;color:var(--gold-cream);letter-spacing:0.14em}
  .step h3{font-size:28px;font-weight:700;line-height:1.1;color:var(--cream-ink);margin:22px 0 14px}
  .step p{font-size:16px;line-height:1.66;color:var(--cream-t2)}

  /* ===== LINEUP (auction-sheet cards) ===== */
  .list-head{display:flex;align-items:flex-end;justify-content:space-between;gap:40px;margin-bottom:24px;flex-wrap:wrap}
  .list-head h2{font-weight:700;font-size:clamp(32px,4vw,56px);line-height:1.02;letter-spacing:-0.016em;color:var(--jf-ink);max-width:680px;text-wrap:balance}
  .list-head .note{font-size:15px;color:var(--jf-t3);max-width:300px;line-height:1.62}
  .marks-legend{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:46px;
    font-family:var(--mono);font-size:10px;letter-spacing:0.12em;color:var(--jf-faint2);text-transform:uppercase}
  .marks-legend .ln{width:18px;height:1px;background:var(--hair-3)}
  .marks-legend b{color:var(--red-mark);font-weight:700}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .vcard{background:var(--jf-card);border:1px solid var(--hair);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;
    transition:border-color .28s var(--ease),transform .28s var(--ease)}
  .vcard:hover{border-color:var(--gold-line);transform:translateY(-5px)}
  .vcard:hover .card-cta{color:var(--gold-2)}
  .vc-photo{position:relative;aspect-ratio:16/10;overflow:hidden;background:var(--jf-bg3)}
  .vc-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 56%;filter:brightness(0.97) contrast(1.04) saturate(0.95)}
  .vc-photo .scrim{position:absolute;inset:0;background:linear-gradient(0deg,rgba(10,12,15,0.74) 0%,rgba(10,12,15,0) 44%)}
  .vc-lot{position:absolute;top:13px;left:13px;font-family:var(--mono);font-size:9px;letter-spacing:0.12em;color:var(--jf-t2);
    background:rgba(7,9,12,0.72);backdrop-filter:blur(6px);padding:5px 9px;border-radius:999px;text-transform:uppercase}
  .vc-sevs{position:absolute;top:13px;right:13px;font-family:var(--mono);font-size:9px;letter-spacing:0.08em;color:var(--green);
    background:var(--green-bg);border:1px solid var(--green-line);padding:5px 9px;border-radius:999px;text-transform:uppercase}
  .vc-tier{position:absolute;left:14px;bottom:12px;font-family:var(--mono);font-size:9px;letter-spacing:0.16em;color:var(--gold-2);text-transform:uppercase}
  .vc-sheet{position:relative;background:var(--jf-sheet);border-bottom:1px solid var(--hair);padding:20px 22px 22px;overflow:hidden}
  .vc-sheet:before{content:"";position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.032) 0 1px,transparent 1px 27px);pointer-events:none}
  .vc-chassis{position:relative;display:flex;justify-content:flex-end;margin-bottom:12px}
  .vc-chassis span{font-family:var(--mono);font-size:9px;letter-spacing:0.08em;color:var(--jf-faint2)}
  .vc-grade-row{position:relative;display:flex;gap:18px;align-items:center}
  .vc-oval{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px}
  .vc-oval .o{width:82px;height:82px;border:2.5px solid var(--red);border-radius:49% 51% 50% 50%;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-5deg)}
  .vc-oval .o .g{font-weight:800;font-size:32px;line-height:0.9;color:var(--jf-ink);transform:rotate(5deg)}
  .vc-oval .o .gl{font-family:var(--mono);font-size:7px;letter-spacing:0.14em;color:var(--red);transform:rotate(5deg);margin-top:1px}
  .vc-oval .int{font-family:var(--mono);font-size:9px;letter-spacing:0.1em;color:var(--jf-faint)}
  .vc-meta{flex:1;min-width:0}
  .vc-meta .nm{font-size:21px;font-weight:600;color:var(--jf-ink);line-height:1.1}
  .vc-meta .sb{font-family:var(--mono);font-size:10px;letter-spacing:0.04em;color:var(--jf-t3);margin-top:7px;line-height:1.5}
  .vc-equip{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  .vc-equip span{font-family:var(--mono);font-size:9px;letter-spacing:0.08em;color:var(--jf-t2);border:1px solid rgba(202,163,76,0.28);padding:3px 7px;border-radius:3px}
  .vc-marks{position:relative;display:flex;align-items:center;gap:14px;margin-top:18px;padding-top:14px;border-top:1px dashed var(--hair-3)}
  .vc-marks .lab{font-family:var(--mono);font-size:9px;letter-spacing:0.14em;color:var(--jf-faint2);text-transform:uppercase}
  .vc-marks .mk{display:flex;gap:12px}
  .vc-marks .mk span{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:0.06em;color:var(--red-mark)}
  .vc-marks .dot{width:7px;height:7px;border-radius:50%;background:var(--red-dot);margin-left:auto}
  .vc-foot{padding:22px;display:flex;flex-direction:column;flex:1}
  .vc-data{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--hair);border-radius:8px;overflow:hidden}
  .vc-data .c{padding:11px 9px;border-right:1px solid var(--hair)}
  .vc-data .c:last-child{border-right:0}
  .vc-data .k{font-family:var(--mono);font-size:8px;letter-spacing:0.1em;color:var(--jf-faint);text-transform:uppercase}
  .vc-data .v{font-family:var(--mono);font-size:13px;color:var(--jf-t2);margin-top:4px}
  .vc-watch{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;
    background:var(--gold-tint);border:1px solid var(--gold-line-2);border-radius:8px;padding:15px 16px}
  .vc-watch .wk{font-family:var(--mono);font-size:11px;letter-spacing:0.12em;color:var(--gold-2);text-transform:uppercase}
  .vc-watch .card-cta{font-size:15px;color:var(--gold-2);transition:color .25s ease;white-space:nowrap;line-height:1}

  /* ===== PINNED LANDED COST (260vh) ===== */
  .cost{position:relative;background:var(--jf-bg2)}
  .cost-pin{position:relative;height:260vh}
  .cost-sticky{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center}
  .cost-bg{position:absolute;inset:0;z-index:0}
  .cost-bg img{width:100%;height:100%;object-fit:cover;object-position:50% 40%;filter:brightness(0.34) contrast(1.05) saturate(0.7)}
  .cost-bg .scrim{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 50%,rgba(10,12,16,0.55),rgba(10,12,16,0.92))}
  .cost-grid{position:relative;z-index:1;max-width:1100px;width:100%;margin:0 auto;padding:0 40px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
  .cost-copy h2{font-weight:700;font-size:clamp(32px,4.2vw,58px);line-height:1.02;letter-spacing:-0.016em;color:var(--jf-ink);text-wrap:balance}
  .cost-copy p{margin-top:24px;max-width:440px;font-size:17px;line-height:1.62;color:var(--jf-t2)}
  .cost-copy .ex{margin-top:30px;font-family:var(--mono);font-size:11px;letter-spacing:0.14em;color:var(--jf-faint);text-transform:uppercase}
  .cost-card{border:1px solid var(--gold-line-2);border-radius:10px;background:rgba(10,12,16,0.6);backdrop-filter:blur(10px);padding:30px 30px 26px}
  .cost-card .ck{font-family:var(--mono);font-size:10px;letter-spacing:0.16em;color:var(--jf-t3);text-transform:uppercase;padding-bottom:8px;display:block}
  .cost-num{font-weight:800;font-size:clamp(58px,7vw,92px);line-height:1;color:var(--gold-2);letter-spacing:-0.02em}
  .cost-lines{margin-top:22px;display:flex;flex-direction:column}
  .cl{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid var(--hair-2);
    opacity:0;transform:translateY(12px);transition:opacity .55s var(--ease),transform .55s var(--ease)}
  .cl.in{opacity:1;transform:none}
  .cl .lab{font-size:14px;color:var(--jf-t2)}
  .cl .amt{font-family:var(--mono);font-size:14px;color:var(--jf-ink);white-space:nowrap}

  /* ===== DIVISION OF LABOUR (split) ===== */
  .divlab{position:relative;background:var(--jf-bg3);overflow:hidden}
  .divlab-bg{position:absolute;inset:0 0 0 50%;z-index:1}
  .divlab-bg img{width:100%;height:100%;object-fit:cover;object-position:46% 50%;filter:brightness(0.62) contrast(1.05) saturate(0.74)}
  .divlab-bg .scrim{position:absolute;inset:0;background:linear-gradient(90deg,var(--jf-bg3) 0%,rgba(10,12,15,0.66) 26%,rgba(10,12,15,0.18) 100%)}
  .divlab-in{position:relative;z-index:2;max-width:1340px;margin:0 auto;padding:140px 40px}
  .divlab-in .box{max-width:600px}
  .divlab h2{font-weight:700;font-size:clamp(34px,4.6vw,62px);line-height:1.02;letter-spacing:-0.016em;color:var(--jf-ink);text-wrap:balance}
  .divlab p{margin-top:26px;font-size:18px;line-height:1.66;color:var(--jf-t2);max-width:500px}
  .divlab p .g{color:var(--gold-2)}
  .dl-split{margin-top:34px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .dl-split .ln{font-style:italic;font-weight:500;font-size:21px;color:var(--jf-ink)}
  .dl-split .dot{width:5px;height:5px;border-radius:50%;background:var(--gold)}

  /* ===== CULTURE BAND ===== */
  .culture{min-height:62vh}
  .culture .moment-bg .scrim{background:linear-gradient(180deg,rgba(7,9,12,0.7) 0%,rgba(7,9,12,0.34) 50%,rgba(7,9,12,0.78) 100%)}
  .culture .moment-in{padding:96px 40px;text-align:center;max-width:1100px}
  .culture h2{font-weight:700;font-size:clamp(30px,4.2vw,58px);line-height:1.04;letter-spacing:-0.014em;text-wrap:balance}
  .culture p{margin:24px auto 0;max-width:560px;font-size:17px;line-height:1.62;color:var(--jf-t2)}
  .culture p .jp{font-style:italic;color:var(--gold-2)}

  /* ===== NUMBERS STRIP ===== */
  .numbers{border-top:1px solid var(--hair-2)}
  .num-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:44px}
  .num{border-top:1px solid var(--hair-3);padding-top:28px}
  .num .v{font-size:clamp(48px,5.8vw,84px);font-weight:800;color:var(--gold-2);line-height:0.98;letter-spacing:-0.01em}
  .num .l{font-size:15px;color:var(--jf-t3);margin-top:14px;max-width:250px;line-height:1.55}

  /* ===== TRUST (cream) ===== */
  .reviews{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
  .review{background:var(--cream-card);border:1px solid rgba(27,28,30,0.1);border-radius:8px;padding:32px 30px;display:flex;flex-direction:column;height:100%;margin:0}
  .review .q{font-weight:600;font-size:40px;line-height:0.6;color:var(--gold);height:24px}
  .review blockquote{font-size:16px;line-height:1.62;color:#2b2c2e;flex:1;margin:8px 0 0}
  .review figcaption{font-family:var(--mono);font-size:11px;letter-spacing:0.08em;color:var(--gold-cream);text-transform:uppercase;margin-top:24px;padding-top:18px;border-top:1px solid var(--cream-hair-2)}

  /* ===== MEMBERSHIP ===== */
  .price{position:relative;overflow:hidden}
  .price-glow{position:absolute;top:60px;left:50%;transform:translateX(-50%);width:560px;height:280px;pointer-events:none;opacity:0.5;
    -webkit-mask-image:radial-gradient(120% 100% at 50% 100%,#000 28%,transparent 74%);mask-image:radial-gradient(120% 100% at 50% 100%,#000 28%,transparent 74%);
    background:radial-gradient(circle at 50% 100%,rgba(232,201,119,0.85),rgba(202,163,76,0.5) 20%,transparent 38%),
      repeating-conic-gradient(from 180deg at 50% 100%,rgba(202,163,76,0.22) 0deg 1.3deg,transparent 1.3deg 8deg)}
  .price-in{position:relative;z-index:1;max-width:1120px;margin:0 auto}
  .tiers{display:grid;grid-template-columns:1fr 1.05fr;gap:24px}
  .tier{position:relative;border:1px solid var(--hair-3);border-radius:8px;padding:42px 38px;display:flex;flex-direction:column;background:var(--jf-card)}
  .tier.feat{border-color:var(--gold-line);background:linear-gradient(180deg,rgba(202,163,76,0.06),rgba(202,163,76,0)),var(--jf-card)}
  .tier .tpill{position:absolute;top:-12px;right:34px;background:var(--gold);color:#15120A;font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:6px 12px;border-radius:999px}
  .tier .tlabel{font-family:var(--mono);font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:var(--jf-t3)}
  .tier.feat .tlabel{color:var(--gold-2)}
  .tier .tprice{display:flex;align-items:baseline;gap:8px;margin-top:18px}
  .tier .tprice .amt{font-size:52px;font-weight:700;color:var(--jf-ink)}
  .tier .tprice .per{font-family:var(--mono);font-size:13px;color:var(--jf-faint)}
  .tier .tsub{font-size:14px;color:var(--jf-faint);margin-top:8px}
  .tier .trule{height:1px;background:var(--hair-3);margin:28px 0}
  .tier ul{list-style:none;display:flex;flex-direction:column;gap:14px;flex:1;margin:0;padding:0}
  .tier li{display:flex;gap:12px;font-size:15px;color:var(--jf-t2)}
  .tier li .tk{color:var(--jf-t3)}
  .tier.feat li{color:var(--jf-ink)}
  .tier.feat li .tk{color:var(--gold)}
  .tier .jf-gold,.tier .jf-dark{margin-top:34px;justify-content:center;padding:15px}
  .price-callout{margin-top:24px;border:1px solid rgba(202,163,76,0.34);background:var(--gold-tint);border-radius:8px;padding:28px 34px;display:flex;gap:22px;align-items:center;flex-wrap:wrap}
  .price-callout .co-tag{font-family:var(--mono);font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold-2);white-space:nowrap}
  .price-callout .co-body{flex:1;min-width:280px}
  .price-callout .co-h{font-size:clamp(19px,1.7vw,23px);font-weight:700;line-height:1.22;color:var(--jf-ink);margin:0 0 9px}
  .price-callout .co-h .g{color:var(--gold-2)}
  .price-callout p{font-size:16px;line-height:1.6;color:var(--jf-t2);margin:0}

  /* ===== FAQ ===== */
  .faq-wrap{max-width:900px;margin:0 auto}
  .faq{border-top:1px solid var(--hair-3)}
  .faq summary{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 0;cursor:pointer;list-style:none;
    font-size:clamp(20px,2.1vw,26px);font-weight:600;color:var(--jf-ink);line-height:1.2}
  .faq summary::-webkit-details-marker{display:none}
  .faq .sign{flex:none;font-weight:300;font-size:28px;color:var(--gold-2);transition:transform .24s var(--ease);line-height:1}
  .faq[open] .sign{transform:rotate(45deg)}
  .faq p{font-size:17px;line-height:1.7;color:var(--jf-t3);padding:0 60px 30px 0;margin:0;max-width:760px}
  .faq-end{border-top:1px solid var(--hair-3)}

  /* ===== FINAL CTA ===== */
  .final{position:relative;overflow:hidden;background:var(--jf-bg)}
  .final-bg{position:absolute;inset:0;z-index:1}
  .final-bg img{width:100%;height:100%;object-fit:cover;object-position:58% 46%;filter:brightness(0.4) contrast(1.06) saturate(0.74)}
  .final-bg .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,9,12,0.74) 0%,rgba(7,9,12,0.5) 48%,rgba(7,9,12,0.9) 100%)}
  .final-in{position:relative;z-index:2;max-width:900px;margin:0 auto;padding:160px 40px;text-align:center}
  .final h2{font-weight:800;font-size:clamp(42px,6.4vw,90px);line-height:0.99;letter-spacing:-0.02em;color:var(--jf-ink);text-wrap:balance}
  .final p{margin:28px auto 0;max-width:520px;font-size:18px;line-height:1.6;color:var(--jf-t2)}
  .final-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:42px}

  /* ===== FOOTER ===== */
  .jf-foot{background:var(--jf-bg);padding:54px 40px;border-top:1px solid var(--hair-2)}
  .jf-foot-in{max-width:1340px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
  .jf-foot .jf-brand svg{height:16px;opacity:0.55}
  .jf-foot .jf-tag{color:var(--jf-faint)}
  .jf-foot .fmid{font-family:var(--mono);font-size:11px;letter-spacing:0.1em;color:var(--jf-faint);text-transform:uppercase}
  .jf-foot .fcopy{font-size:12px;color:var(--jf-faint)}

  /* ===== MOTION ===== */
  @keyframes jfTicker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes jfScroll{0%{transform:scaleY(0);transform-origin:top}40%{transform:scaleY(1);transform-origin:top}40.01%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
  .rv{opacity:0;transform:translateY(38px) scale(0.985);transition:opacity .95s var(--ease),transform .95s var(--ease);will-change:opacity,transform}
  .rv.in{opacity:1;transform:none}
  .rv-d1{transition-delay:.09s}.rv-d2{transition-delay:.18s}.rv-d3{transition-delay:.27s}.rv-d4{transition-delay:.36s}
  @media (prefers-reduced-motion:reduce){
    .jf .ticker-row,.jf .scroll-cue span.b{animation:none}
    .jf .rv,.jf .cl{opacity:1 !important;transform:none !important;transition:none}
    .jf .feat-bg img,.jf .hero-bg img{transform:none !important}
  }

  /* ===== RESPONSIVE (one breakpoint family around 920px) ===== */
  @media(max-width:920px){
    .jf-nav-links{display:none}
    .nav-burger{display:flex}
    .feat-callout h2{font-size:clamp(32px,8vw,52px)}
    .steps,.cards,.num-grid,.reviews,.tiers,.cost-grid{grid-template-columns:1fr}
    .cards{max-width:460px;margin:0 auto}
    .step{border-right:0;border-bottom:1px solid var(--cream-hair-2)}
    .divlab-bg{position:relative;inset:auto;height:62vw;left:0}
    .divlab-in{padding-top:96px}
    .cost-pin{height:auto}
    .cost-sticky{position:static;height:auto;overflow:visible;display:block}
    .cost-grid{padding-top:88px;padding-bottom:88px;gap:30px}
    .cl{opacity:1;transform:none}
    .hero-bg .scrim{background:linear-gradient(90deg,var(--jf-bg) 6%,rgba(7,9,12,0.74) 60%,rgba(7,9,12,0.5) 100%),linear-gradient(0deg,rgba(7,9,12,0.7),transparent 45%)}
  }
  @media(max-width:760px){
    .sec{padding:88px 22px}
    .jf-nav-in{padding:16px 22px}
    /* Keep the "Start free" CTA and the menu button on one row without
       overflowing small phones: tighten the gap, shrink the logo and CTA. */
    .jf-nav-right{gap:14px}
    .jf-nav .jf-gold{padding:10px 16px;font-size:13px}
    .jf-brand svg{height:16px}
    .hero-wrap{padding:96px 22px 120px}
    .hero h1{font-size:clamp(38px,10vw,68px)}
    .hero-sub{font-size:17px}
    .moment-in,.divlab-in,.final-in,.feat-in,.cost-grid,.culture .moment-in{padding-left:22px;padding-right:22px}
    .moment-in{padding-top:96px;padding-bottom:96px}
    .final-in{padding-top:110px;padding-bottom:110px}
    .feat-deck{min-height:400px}
    .feat-callout p{font-size:16px}
    .list-head{gap:18px}
    .cost-card{padding:24px 20px}
    .cost-num{font-size:clamp(40px,11vw,72px)}
    .tier{padding:34px 24px}
    .price-callout{padding:24px 22px}
    .price-callout .co-body{min-width:0}
    .faq summary{gap:16px}
    .faq p{padding-right:0}
  }
  /* Very small screens: the auction-sheet 4-up data grid is too tight, so the
     Year/Odo/Engine/Trans cells wrap to a readable 2x2. */
  @media(max-width:420px){
    /* Smallest phones: drop the "Finder" tag and trim the logo/CTA so the
       "Start free" button is never clipped against the menu button. */
    .jf-tag{display:none}
    .jf-brand svg{height:15px}
    .jf-nav-right{gap:9px}
    .jf-nav .jf-gold{padding:10px 13px}
    /* Auction card: shrink the fixed grade oval so the car name + specs aren't
       squashed on ~320px phones. */
    .vc-oval .o{width:66px;height:66px}
    .vc-oval .o .g{font-size:26px}
    .vc-grade-row{gap:12px}
    .vc-data{grid-template-columns:repeat(2,1fr)}
    .vc-data .c{border-bottom:1px solid var(--hair)}
    .vc-data .c:nth-child(2n){border-right:0}
    .vc-data .c:nth-child(n+3){border-bottom:0}
    .vc-sheet,.vc-foot{padding-left:18px;padding-right:18px}
    .dl-split{gap:6px 14px}
    .dl-split .ln{font-size:19px}
  }
`;
