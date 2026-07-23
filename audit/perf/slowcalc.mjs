// Throwaway local stand-in for the landed-cost calculator, so the SERVER-SIDE
// per-row calculator latency is measurable in the sandbox (the real
// calculator.jdmconnect.com.au is unreachable here and fails fast, hiding the
// blocking cost). Responds to POST / after DELAY_MS with the calc JSON shape
// estimateLanded expects, and counts hits so a curl of a page reveals exactly
// how many calculator calls its server render made.
//   GET /__count           -> { hits } and RESETS the counter
// Run: DELAY_MS=300 node audit/perf/slowcalc.mjs   (listens on 9999)
import { createServer } from "node:http";

const DELAY_MS = Number(process.env.DELAY_MS || 300);
const PORT = Number(process.env.PORT || 9999);
let hits = 0;

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__count") {
    const body = JSON.stringify({ hits });
    hits = 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(body);
  }
  // Any other request is treated as a calculator POST.
  hits++;
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    setTimeout(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        calc: { grandTotal: 50000, landedAtPort: 40000, purchaseAUD: 30000 },
        activeLineName: "TestLine",
      }));
    }, DELAY_MS);
  });
}).listen(PORT, "127.0.0.1", () => console.log(`slowcalc on :${PORT} delay ${DELAY_MS}ms`));
