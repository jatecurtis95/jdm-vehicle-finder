// Landing page content model (the "data model" from the JDMFinder v2 design
// handoff). Kept separate from markup so the copy is editable in one place and,
// later, swappable for live data (lineup from the auction feeds, cost lines from
// the real landed-cost calculator). See the handoff "Making it live" section.
//
// Copy rule (whole codebase): no em or en dashes. Use commas, periods, hyphens,
// or the middot separator. Two extra guards specific to the landing tests:
//   - never the substring "importer" (stale-pricing guard in pages.test.mjs);
//     we say "import agents" instead.
//   - the membership price is templated by landing.js, never hardcoded here.

// Auction ticker: one scrolling string of live-looking lots. Duplicated in the
// markup for a seamless marquee loop.
const tickLot = (id, car, grade, yen) =>
  `LOT ${id} &middot; ${car} &middot; GRADE ${grade} &middot; &yen;${yen}`;

export const TICKER =
  [
    tickLot("4471", "R32 GT-R", "4", "3,180,000"),
    tickLot("2208", "GDB WRX STI", "4", "1,420,000"),
    tickLot("8814", "FD3S RX-7", "4", "5,420,000"),
    tickLot("1067", "S15 SILVIA", "4B", "1,980,000"),
    tickLot("5530", "CT9A EVO VI", "4", "2,310,000"),
    tickLot("3392", "JZX100 CHASER", "4", "1,760,000"),
    tickLot("7745", "AE86 LEVIN", "3", "1,640,000"),
  ].join("&nbsp;&nbsp;&nbsp;//&nbsp;&nbsp;&nbsp;") + "&nbsp;&nbsp;&nbsp;//&nbsp;&nbsp;&nbsp;";

// Feature-pin callouts ("Under the hood"). Cross-fade as the visitor scrolls the
// tall pinned stage.
export const FEATURES = [
  { k: "01", big: "40,000 listings, scanned daily.", sub: "USS, TAA and ASNET, every major Japanese auction house, swept each morning before you&rsquo;ve had your coffee." },
  { k: "02", big: "Auction sheets, translated.", sub: "Grade, mileage, every inspector mark and panel note, rendered in plain English the moment a car appears." },
  { k: "03", big: "Eligibility, checked instantly.", sub: "SEVS and age rules applied to every lot, so you never fall for a car you can&rsquo;t register in Australia." },
];

// Count-up "by the numbers" strip.
export const NUMBERS = [
  { to: 40000, pre: "", post: "", start: "40,000", label: "auction listings scanned every single day" },
  { to: 3, pre: "", post: "", start: "3", label: "auction houses in one live feed: USS, TAA and ASNET" },
  { to: 100, pre: "", post: "%", start: "100%", label: "of the landed cost shown up front, before you bid" },
];

// How it works.
export const STEPS = [
  { n: "01", title: "Tell us your car.", body: "Make, model, years, budget. Two minutes, free, no card. We start watching for it straight away." },
  { n: "02", title: "Watch the auctions.", body: "Browse USS, TAA and ASNET yourself, with import eligibility and the real landed cost built into every lot." },
  { n: "03", title: "Commit when it&rsquo;s right.", body: "Found the one? We bid, ship, handle compliance and deliver to your door, and your membership comes off the fee." },
];

// The lineup: auction-sheet cards. `photo` is optional; without it the card
// shows the atmospheric placeholder (real auction imagery is wired in later).
export const LINEUP = [
  { tier: "Attainable", lot: "10203", name: "1997 Nissan 180SX", sub: "RPS13 Type X &middot; SR20DET &middot; white to purple repaint", grade: "3.5", intGrade: "C", year: "1997", odo: "144,440 km", engine: "SR20DET", trans: "5MT", chassis: "RPS13-327057", equip: ["AAC", "PS", "PW", "LSD", "AW"], marks: ["A2", "U1", "U2"], photo: "180sx_rps13.jpg" },
  { tier: "Sweet spot", lot: "23131", name: "2001 Toyota Chaser", sub: "JZX100 Tourer V &middot; 1JZ-GTE &middot; white", grade: "4", intGrade: "C", year: "2001", odo: "86,600 km", engine: "1JZ-GTE", trans: "5MT", chassis: "JZX100-0118581", equip: ["SR", "PS", "PW", "AW", "NAVI"], marks: ["A1", "A2", "U2"], photo: "chaser_jzx100.jpg" },
  { tier: "The dream", lot: "65206", name: "1999 Nissan Silvia", sub: "S15 Spec R &middot; SR20DET &middot; white", grade: "3.5", intGrade: "B", year: "1999", odo: "111,984 km", engine: "SR20DET", trans: "6MT", chassis: "S15-000964", equip: ["PS", "PW", "AW", "RECARO"], marks: ["U1"], photo: "s15_specr.jpg" },
];

// Worked landed-cost example: a ¥5,000,000 bid landed in Fremantle, WA. The line
// items sum to COST_TOTAL, which the cost card counts up to as it pins.
export const COST_TOTAL = 63780;
export const COST_LINES = [
  { label: "Winning bid (&yen;5,000,000)", amount: "A$44,771" },
  { label: "Japan fees, transport and export", amount: "A$2,372" },
  { label: "Shipping and marine insurance", amount: "A$3,057" },
  { label: "GST and customs entry", amount: "A$5,240" },
  { label: "Compliance and agency", amount: "A$3,700" },
  { label: "WA on-road (stamp duty, rego, RWC)", amount: "A$4,640" },
];

export const REVIEWS = [
  { quote: "I was hesitant because I didn&rsquo;t know how to navigate the import process myself. They were outstanding from start to finish, every step explained.", who: "WRX buyer" },
  { quote: "Bought a 1989 twin-turbo 300ZX through JDM Connect and couldn&rsquo;t be happier. Updated me every step, and I spent A$6k less than I expected.", who: "300ZX buyer" },
  { quote: "Importing an older car meant asbestos compliance and testing, but they handled it professionally and every fee was transparent. No surprises.", who: "1989 R32 Type M buyer" },
];

// FAQ. `{price}` is substituted by landing.js so the copy tracks the live
// membership price from admin Settings.
export const FAQS = [
  { q: "Why pay {price} when you find cars anyway?", a: "Membership lets you look yourself, browse the auctions and see real landed prices while you&rsquo;re still deciding. And it isn&rsquo;t really an extra cost, since it credits off your import fee when you go ahead." },
  { q: "Can I cancel?", a: "Anytime, in one click. No lock-in, no contracts." },
  { q: "Do I have to import through you?", a: "No, membership is yours to use however you like. But when you&rsquo;re ready, going ahead with us is where your credit kicks in, and where we take the hard part off your hands." },
  { q: "What does the credit actually mean?", a: "Up to six months of your {price} membership comes off your import fee when you import with us. Looking around pays for itself the moment you commit." },
  { q: "I added my car but nothing&rsquo;s showing up. What does that mean?", a: "Usually one of three things. Your budget might be sitting under what that model currently goes for at auction, the car might be genuinely rare and only crosses the block now and then, or nothing matching has simply come up yet. Auctions refresh constantly, so leave your request running and we&rsquo;ll alert you the moment one lands. Not sure your budget&rsquo;s realistic for the car you want? Ask us. We&rsquo;ll tell you straight, and point you at what your money does buy right now." },
];
