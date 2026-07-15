// Buyer-portal sidebar, shared by the portal pages in admin.js and the
// Auction History page (auction-history.js). Lives in its own module so both
// can import it without a dependency cycle.
import { esc } from "./render.js";
import { LOGO } from "./theme.js";

export function portalSidebar(c, active = "garage") {
  // The legacy /portal/sold page highlights the Auction history entry that
  // replaced its own nav item.
  if (active === "sold") active = "history";
  const item = (id, href, label) => `<a class="${active === id ? "active" : ""}"${active === id ? ' aria-current="page"' : ''} href="${href}"><span class="bar" aria-hidden="true"></span><span class="lbl">${label}</span></a>`;
  // The auction search page is a paid-member perk, gated on clients.member.
  const auctions = c && c.member ? item("auctions", "/portal/auctions", "Auction search") : "";
  // Auction history supersedes the old "Sold auctions" entry in the nav; the
  // /portal/sold route itself stays live for existing bookmarks.
  const history = c && c.member ? item("history", "/portal/history", "Auction history") : "";
  return `<aside class="side">
    <div class="brand">${LOGO}</div>
    <nav class="nav">${item("garage", "/portal", "Your garage")}${auctions}${history}</nav>
    <div class="side-foot">
      <div class="whoami"><span class="who-name">${esc(c?.name || "You")}</span><span class="who-role">${c && c.member ? "Member" : "Client"}</span></div>
      <a class="signout" href="/logout">Sign out</a>
    </div>
  </aside>`;
}
