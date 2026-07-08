# JDM Connect Vehicle Finder — How-To Guide

A plain-English walkthrough of the whole site: what every screen does, and how
to get your day-to-day jobs done. Screenshots are from the live app.

- **Public site:** [jdmfinder.com.au](https://jdmfinder.com.au)
- **Sign in:** [jdmfinder.com.au/login](https://jdmfinder.com.au/login)

---

## Contents

1. [Who uses the site](#1-who-uses-the-site)
2. [The public site & customer signup](#2-the-public-site--customer-signup)
3. [Signing in & resetting passwords](#3-signing-in--resetting-passwords)
4. [The admin dashboard](#4-the-admin-dashboard)
5. [Requests — your pipeline](#5-requests--your-pipeline)
6. [Matches — review & send cars](#6-matches--review--send-cars)
7. [Customers & the client page (Find a car)](#7-customers--the-client-page-find-a-car)
8. [Auctions — searching the live feed](#8-auctions--searching-the-live-feed)
9. [Agents](#9-agents)
10. [Settings](#10-settings)
11. [The buyer portal (what your customers see)](#11-the-buyer-portal-what-your-customers-see)
12. [Everyday workflows — quick reference](#12-everyday-workflows--quick-reference)

---

## 1. Who uses the site

There are four kinds of login, and the site shows each one only what they need:

| Role | Who | What they see |
|---|---|---|
| **Admin** | You (JDM Connect) | Everything: every customer, request, match, agent, payment and setting. |
| **Agent** | A partner who finds cars for their own buyers | Only the customers assigned or shared to them, and those customers' searches and matches. |
| **Customer (buyer)** | The end buyer | The **buyer portal**: the cars found for them and the searches you're running. |
| **Dealer** | A trade partner submitting vehicles | The dealer portal (vehicle submissions & review). |

> **Rule of thumb:** an agent can only see a customer if that customer is
> **assigned to them as Owner** or **shared** with them. A customer you create
> yourself is owned by "JDM Connect" and is invisible to agents until you
> assign or share them.

---

## 2. The public site & customer signup

### The landing page

The public homepage explains the service and pushes visitors to start a search.
The vehicle strip lower down shows **genuinely upcoming lots pulled live from
the auction feed** (it hides itself if the feed has nothing to show, so it
never displays stale cars).

![Landing page](docs/images/01-landing.png)

### The request wizard (how a customer signs up)

"Start free" / "Start a vehicle search" opens a four-step wizard. This is how
every new customer and search enters the system.

![Request wizard, step 1](docs/images/02-request-wizard.png)

1. **Find car** — pick a popular preset or type a Make and Model, plus a year
   range. **Refine my search** adds optional filters: max mileage, minimum
   auction grade, chassis code, and the **Model code** and **Grade** pickers
   (see [Model codes](#model-codes--grades-precise-variant-targeting)).
2. **Budget** — the customer's all-in AUD budget and their state/country.
3. **Review** — a summary of what they're chasing.
4. **Account** — email + password to create their login.

**What happens after they submit:**
- A new account is created and their search starts running against the auctions.
- If the email already has an account, we don't create a duplicate — we quietly
  email that inbox a sign-in link instead (so nobody can probe who's registered).
- Matches are **reviewed by staff before they're sent** (this is the default —
  see [Settings → Free tier](#free-tier--search-runs)).

---

## 3. Signing in & resetting passwords

Everyone signs in at the same screen. Admins can leave the email blank and just
enter the admin password; agents, customers and dealers use their email + password.

![Login screen](docs/images/03-login.png)

### Forgot password

Anyone can reset their own password from the **Forgot password?** link. They
enter their email and receive a link (valid for 1 hour) to choose a new one.

![Forgot password](docs/images/04-forgot-password.png)

The confirmation looks identical whether or not the email has an account, so
the form can't be used to find out who's registered. You can also trigger a
reset for someone from their record in the admin.

---

## 4. The admin dashboard

Your home screen — "what needs me today," answered. Everything is one tap away.

![Admin dashboard](docs/images/10-admin-dashboard.png)

- **Needs attention today** — the counts that matter: new leads to contact,
  auctions closing in 48h, matches to review, follow-ups, stalled requests,
  deposits outstanding, and tasks.
- **Pipeline strip** — how many requests sit at each stage (New → Delivered).
- **Team overview** — active clients, agents, open requests, cars sent this week.
- **Triage lists** — "Who's gone quiet?", "Which requests are stalled?", "Who
  owes money?", "Who's closest to buying?" — each links straight to the work.
- **Run Searches** (gold button, bottom of the sidebar) — runs every active
  saved search against the latest auction lots right now and drops new matches
  into the review queue. It normally runs automatically on a schedule; this is
  the manual "do it now" button.

The **sidebar** is your main navigation (Dashboard, Requests, Tasks, Matches,
Customers, Auctions, Agents, Payments, Settings) and a **global search** box at
the top for finding a customer, vehicle, chassis code or lot fast.

---

## 5. Requests — your pipeline

Every customer search is a "request." This page is deliberately simple: the
**most recent requests sit at the top**, and each row shows the customer, what
they want, the latest car queued for them, the stage, and last activity.

![Requests](docs/images/11-admin-requests.png)

- Click a customer or vehicle to open their **full profile**.
- The **stage dropdown** on each row moves a request along the pipeline (New →
  Qualified → Searching → Vehicles sent → Interested → Deposit → Purchased →
  … → Delivered).
- The stage cards along the top filter the list to one stage.

When a customer taps **"I'm interested"** in their portal, that request jumps to
the **Interested** stage here in real time.

---

## 6. Matches — review & send cars

The money screen. When a search finds a car, it lands here for you to review
before the customer ever sees it.

![Matches](docs/images/12-admin-matches.png)

Each match card shows the car, its **strength** (Strong / Good / Possible), the
auction grade, the **landed-cost estimate** (the money figure), and the auction
close date. From here you:

- **Approve & send** — emails (and optionally WhatsApps) the car to the customer.
- **Skip** — removes it from the queue.
- **Select several** and send them as **one combined email** rather than one per car.

Approving is one tap; sending several is select + one tap + confirm.

---

## 7. Customers & the client page (Find a car)

### Customers list

Your CRM. Find anyone, see how warm they are, and manage who owns them.

![Customers](docs/images/13-admin-customers.png)

Columns show each customer's searches, matches waiting, pipeline stage, last
contact, **last login**, owner and who they're shared with. Use the category
tabs (All / Private / Dealers) and the search box to narrow the list. Admins
can bulk-assign, share or archive from the tick boxes.

### The client page — and "Find a car"

Open a customer to see their full record: contact details, engagement stats,
their searches, the cars found for them, and their activity timeline.

![Client detail with Find a car](docs/images/14-admin-client-detail.png)

The key tool here is **Find a car** (the gold button / the `#find` card). It
runs a **live auction search for this specific customer**: search the Japanese
auctions, and add any lot straight to their review queue with one click. It
pre-fills from the customer's saved search so you don't retype it.

> This search form now appears for **any staff member who can see the
> customer** — the owning agent, an agent the customer is shared with, or you.
> (Editing contact details and portal access stay owner/admin-only.)

**Buyer portal controls** on this page let you give a customer portal access
(emails them a set-password link), resend it, revoke it, or make them a paid
**Member**.

---

## 8. Auctions — searching the live feed

A standalone workspace to search the live Japanese auctions and look up
sold-price history, independent of any one customer.

![Auctions workspace](docs/images/15-admin-auctions.png)

- **Filters:** Make, Model, **Model code**, and Auction house. Changing a filter
  **no longer fires the search instantly** — it refills the dependent dropdowns
  in the background and waits for you to press **Search**, so you can set up all
  your filters first. "More filters" adds year, price and grade.
- **Tabs:** Live auctions · Watchlist · Sold auctions · Sold prices.
- **Result cards** show the car, grade, eligibility, auction house and price,
  with a **Sheet** button when the inspection sheet is available. Tick a card to
  select it for a client; click anywhere else on the card to open its full listing.
- The **auction house list is built from the live feed itself**, so houses that
  only appear on auction day (e.g. USS JAA) show up automatically.

### Model codes & grades (precise variant targeting)

Make + Model isn't enough for many cars (a Mercedes S-Class hides the S450; a
Crown spans four very different variants). So searches can also carry:

- **Model code** — the chassis/model code, shown with a friendly label
  (e.g. `BNR34 - Skyline GT-R (R34)`), pulled from the feed for the chosen make.
- **Grade** — pick every spelling of the variant grade you'd accept (auction
  houses spell the same grade many ways); they're matched together.

These appear on the public wizard, the admin "Add a search" form, and the buyer
portal. When set, the matcher narrows precisely to them; when left blank,
matching behaves exactly as before.

---

## 9. Agents

Manage the partner logins who find cars for their own buyers.

![Agents](docs/images/16-admin-agents.png)

Each agent row shows their **client count**, **open requests**, and **last
login**, plus toggles for alerts and active/paused status. "Invite a new agent"
emails them a link to set their own password; from then on they see only their
own (and shared) customers and matches.

---

## 10. Settings

Everything you can change without a developer — grouped into cards, with a jump
nav at the top.

![Settings](docs/images/17-admin-settings.png)

- **Notifications** — the alert email address and which emails go out (staff
  digest, new-request alerts, match-on-approval to clients).
- **WhatsApp** — turn on WhatsApp delivery of matches and choose the provider.
- **Client-facing** — whether customers see the landed cost and market price.
- **Payments** — Stripe deposits: enable, set the amount and currency, webhook.
- **Pricing** — the Full Access membership price and the free result limit.
- **Free tier & search runs** *(new)* — two switches, changeable any time:
  - *Auto-send the first match to free signups* — **off by default**, so staff
    review matches before they're sent.
  - *Run Searches includes free accounts* — **on by default**, so the matcher
    runs everyone's searches, not just paid members.
  - Plus the number of active searches a free account may keep (default 1).
- **Landed cost assumptions** *(new)* — edit the compliance cost, agency fee and
  an FX override that feed every landed-price estimate, with no deploy needed.
  (Shipping, duties and on-road costs still come from the live calculator per
  state. If an accurate figure can't be produced for a lot, the figure is
  hidden rather than shown wrong.)
- **AI auction-sheet reader** — reads the Japanese inspection sheet from a car's
  photos; choose when it runs and which model.

Changes are saved with the sticky **Save settings** bar; you're warned if you
try to leave with unsaved edits.

---

## 11. The buyer portal (what your customers see)

When you give a customer portal access, this is their view. Clean, simple, and
focused on the cars you've found for them.

![Buyer portal](docs/images/20-buyer-portal.png)

- **Your garage** — a stat strip (new for you, cars found, in progress, active
  searches), and the **cars we've found for you**, each with the vehicle, grade,
  odometer, auction estimate and the **indicative landed price**. The card links
  through to the full listing. **"Ask us to get this"** flags the car — which
  drops it onto your Requests page as *Interested* in real time.
- **What you're searching for** — their saved searches, which they can edit,
  pause, delete, or add to (free accounts are limited to one active search;
  members are unlimited).
- **Members** also get **Auction search** and **Sold auctions** in the sidebar,
  to browse the live floor themselves.

Non-members see an upgrade prompt for **Full Access**; the Subscribe flow lands
on a real page (with the price and a subscribe button, or an honest note if
online purchase isn't available yet).

---

## 12. Everyday workflows — quick reference

**A new lead came in**
→ Dashboard shows it under "New leads to contact." Open the request, call/message
the customer, move the stage to *Qualified*.

**Find a car for a customer**
→ Open the customer → **Find a car** → search the auctions → add the best lots to
their queue → go to **Matches** → *Approve & send*.

**A customer said they're interested**
→ It appears on **Requests** as *Interested* automatically (from their portal).
Chase the deposit; move the stage along as you go.

**Reset someone's password**
→ Tell them to use **Forgot password?** on the login page, or trigger it from
their record. New agents/customers get a set-password link by email.

**Give a customer portal access**
→ Open the customer → **Give portal access** (needs an email on file). To make
them a paying member, use **Make member**.

**Add a partner agent**
→ Settings-adjacent **Agents** → *Invite a new agent* → assign or share customers
to them so they show up in that agent's login.

**Change how free accounts behave, or the landed-cost figures**
→ **Settings → Free tier** and **Settings → Landed cost**. No deploy needed.

---

*Questions or something not behaving as described? The behaviour above matches
the live site as deployed. If a screen looks different, do a hard refresh
(Ctrl/Cmd + Shift + R) to clear a cached older version.*
