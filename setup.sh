#!/usr/bin/env bash
#
# JDM Vehicle Finder — one-shot setup for Cloudflare.
#
# Prerequisites (do these once, they're the only manual bits):
#   1. Node.js installed (you already use npx/wrangler, so this is covered).
#   2. Logged into Cloudflare:   npx wrangler login
#   3. (For email) a Resend API key from https://resend.com — optional at first.
#
# Then just run:   bash setup.sh
#
# Optional: pass a Resend key inline to wire up email in one go:
#   RESEND_API_KEY=re_xxx bash setup.sh

set -euo pipefail
cd "$(dirname "$0")"

DB_NAME="jdm-vehicle-finder"

echo "==> 1/7 Installing dependencies"
npm install

echo "==> 2/7 Creating D1 database (skips if it already exists)"
CREATE_OUTPUT="$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)"
echo "$CREATE_OUTPUT"

# Find the database id from the create output, or look it up if it already exists.
DB_ID="$(echo "$CREATE_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n1 || true)"
if [ -z "$DB_ID" ]; then
  echo "    (database already exists — looking up its id)"
  DB_ID="$(npx wrangler d1 list --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);const m=a.find(x=>x.name==="'"$DB_NAME"'");console.log(m?(m.uuid||m.database_id||""):"")}catch(e){}})')"
fi
if [ -z "$DB_ID" ]; then
  echo "ERROR: couldn't determine the D1 database id."
  echo "Run 'npx wrangler d1 list', copy the id, paste it into wrangler.toml, then re-run."
  exit 1
fi
echo "    D1 id: $DB_ID"

echo "==> 3/7 Writing the database id into wrangler.toml"
node -e '
const fs=require("fs"); const id=process.argv[1];
let t=fs.readFileSync("wrangler.toml","utf8");
t=t.replace(/database_id = ".*"/, `database_id = "${id}"`);
fs.writeFileSync("wrangler.toml",t);
' "$DB_ID"

echo "==> 4/7 Loading the database schema"
npx wrangler d1 execute "$DB_NAME" --remote --file schema.sql

echo "==> 5/7 Setting secrets"
# AVTONET API code (defaults to the one on file; override with AVTONET_CODE=... )
printf '%s' "${AVTONET_CODE:?Set AVTONET_CODE in your environment before running setup}" | npx wrangler secret put AVTONET_CODE
# Admin token (random, gates the admin page)
ADMIN_TOKEN="$(openssl rand -hex 24)"
printf '%s' "$ADMIN_TOKEN" | npx wrangler secret put ADMIN_TOKEN
# Resend key (optional — email won't send until this is set)
if [ -n "${RESEND_API_KEY:-}" ]; then
  printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY
else
  echo "    (no RESEND_API_KEY provided — set it later with: npx wrangler secret put RESEND_API_KEY)"
fi

echo "==> 6/7 Deploying"
DEPLOY_OUTPUT="$(npx wrangler deploy 2>&1)"
echo "$DEPLOY_OUTPUT"
URL="$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9._-]+\.workers\.dev' | head -n1 || true)"

echo "==> 7/7 Pointing approve/skip links at the live URL"
if [ -n "$URL" ]; then
  node -e '
  const fs=require("fs"); const url=process.argv[1];
  let t=fs.readFileSync("wrangler.toml","utf8");
  t=t.replace(/PUBLIC_URL = ".*"/, `PUBLIC_URL = "${url}"`);
  fs.writeFileSync("wrangler.toml",t);
  ' "$URL"
  npx wrangler deploy >/dev/null
  echo ""
  echo "============================================================"
  echo " DONE."
  echo " Admin panel:  $URL/admin?key=$ADMIN_TOKEN"
  echo " Save this ADMIN_TOKEN somewhere safe: $ADMIN_TOKEN"
  echo "============================================================"
else
  echo "Deployed, but couldn't auto-detect the URL."
  echo "Find it in the output above, put it in PUBLIC_URL in wrangler.toml, and run: npx wrangler deploy"
  echo "Your ADMIN_TOKEN: $ADMIN_TOKEN"
fi
