#!/usr/bin/env bash
# First production deploy of the password-gated demo (D-026). Run it yourself, in your own terminal: a Claude session
# is refused `vercel env` writes, DNS changes and production deploys. No secret is printed. The script asks for the
# demo password, and everything else is generated here or read from neonctl.
#   bash scripts/deploy-prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."

NEON_PROJECT=icy-wave-14607298
NEON_ORG=org-morning-smoke-06224724
TEAM=team_HJnm56EPKbrqWwd75nQEytBd
HOST=tradepost.labintelligence.co

[ -e .env.production.local ] && { echo ".env.production.local already exists; move it aside first." >&2; exit 1; }
git check-ignore -q .env.production.local || { echo ".env.production.local is not gitignored; stopping." >&2; exit 1; }

read -rsp "Demo password (shared with viewers): " DEMO_ACCESS_PASSWORD; echo
[ -n "$DEMO_ACCESS_PASSWORD" ] || { echo "empty password" >&2; exit 1; }

DATABASE_URL=$(neonctl connection-string --project-id "$NEON_PROJECT" --org-id "$NEON_ORG" --pooled)
DIRECT_URL=$(neonctl connection-string --project-id "$NEON_PROJECT" --org-id "$NEON_ORG")
AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 24)

# The same values go to Vercel and to .env.production.local: the seed seals the demo TOTP secret with AUTH_SECRET,
# so the two must match or the TOTP accounts cannot sign in.
umask 077
cat > .env.production.local <<EOF
DATABASE_URL=$DATABASE_URL
DIRECT_URL=$DIRECT_URL
AUTH_SECRET=$AUTH_SECRET
APP_URL=https://$HOST
CRON_SECRET=$CRON_SECRET
DEMO_MODE=1
EMAIL_ENABLED=0
SMS_ENABLED=0
DEMO_ACCESS_PASSWORD=$DEMO_ACCESS_PASSWORD
EOF

echo "== Vercel production env"
while IFS='=' read -r name value; do
  printf '%s' "$value" | vercel env add "$name" production --force --scope "$TEAM" >/dev/null
  echo "  set $name"
done < .env.production.local

echo "== Migrate and seed Neon (demo accounts + the seeded month)"
npm run -s db:migrate:prod
npm run -s seed:prod

echo "== DNS: A $HOST -> 76.76.21.21, DNS-only"
ZONE=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=labintelligence.co" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["id"])')
EXISTING=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?name=$HOST" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["result"]))')
if [ "$EXISTING" = 0 ]; then
  curl -fsS -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
    --data "{\"type\":\"A\",\"name\":\"$HOST\",\"content\":\"76.76.21.21\",\"proxied\":false,\"ttl\":1}" >/dev/null
  echo "  created"
else
  echo "  a record for $HOST already exists; left alone"
fi

# The main-manual deploy hook builds what is pushed to GitHub main, never this working tree (vercel.json turns
# push-to-deploy off).
echo "== Production deploy (main-manual hook)"
HOOK=$(vercel api "/v9/projects/tradepost?teamId=$TEAM" 2>/dev/null | python3 -c '
import json,sys; raw=sys.stdin.read(); d=json.loads(raw[raw.index("{"):])
print(next(h["url"] for h in d["link"]["deployHooks"] if h["name"]=="main-manual"))')
curl -fsS -X POST "$HOOK" >/dev/null
echo "Triggered. Watch it with: vercel ls tradepost --scope $TEAM"
echo "Then open https://$HOST (any username, the password above), and /demo."
