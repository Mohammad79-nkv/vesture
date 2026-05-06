#!/usr/bin/env bash
# Vesture — Phase 1 smoke test
#
# Hits every public + auth-redirect route and checks the HTTP code matches
# what we expect. Run after a clean dev start (or against any env) to catch
# regressions in chrome wiring, locale routing, and auth gates without
# walking through the UI by hand.
#
# Usage:
#   pnpm dev &                      # in another tab
#   ./scripts/smoke.sh              # default → http://localhost:3000
#   ./scripts/smoke.sh https://vesture.app

set -e

# Ensure system bin is reachable when invoked from minimal-env sandboxes
# (CI runners, some IDE integrations) where /usr/bin can be missing from PATH.
export PATH="/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"

BASE="${1:-http://localhost:3000}"

# Each row: METHOD | PATH | EXPECTED_CODE | NOTE
ROWS=(
  "GET|/en|200|welcome (signed-out)"
  "GET|/ar|200|welcome AR"
  "GET|/fa|200|welcome FA"

  "GET|/en/products|200|catalog"
  "GET|/en/products?category=TOPS|200|catalog filter"
  "GET|/ar/products|200|catalog AR"

  "GET|/en/sellers|404|sellers index (intentional 404 — direct seller URLs only)"

  "GET|/en/onboarding/sign-up|200|custom sign-up form"
  "GET|/en/onboarding/sso-callback|200|OAuth landing"
  "GET|/en/onboarding/taste|307|auth redirect"

  "GET|/en/closet|200|empty intro signed-out"
  "GET|/en/closet/add|307|auth redirect"
  "GET|/en/me|307|auth redirect"
  "GET|/en/me/edit|307|auth redirect"
  "GET|/en/favorites|307|auth redirect"

  "GET|/en/dashboard|307|seller-only redirect"
  "GET|/en/admin/users|307|admin-only redirect"
  "GET|/en/admin/sellers|307|admin-only redirect"
  "GET|/en/admin/audit|307|admin-only redirect"

  "POST|/api/upload|401|unauthenticated upload"
  "POST|/api/upload?kind=closet|401|unauthenticated closet upload"
)

PASS=0
FAIL=0

printf "Smoke testing %s\n\n" "$BASE"
printf "%-6s  %-40s  %-6s  %s\n" "METH" "PATH" "GOT" "NOTE"
printf "%s\n" "$(printf '%.0s-' {1..90})"

for row in "${ROWS[@]}"; do
  IFS='|' read -r METHOD PATH EXPECTED NOTE <<<"$row"
  GOT=$(/usr/bin/curl -s -o /dev/null -w '%{http_code}' -X "$METHOD" "$BASE$PATH")
  if [ "$GOT" = "$EXPECTED" ]; then
    printf "\033[0;32m✓\033[0m %-4s  %-40s  %-6s  %s\n" "$METHOD" "$PATH" "$GOT" "$NOTE"
    PASS=$((PASS+1))
  else
    printf "\033[0;31m✗\033[0m %-4s  %-40s  %-6s  expected %s · %s\n" "$METHOD" "$PATH" "$GOT" "$EXPECTED" "$NOTE"
    FAIL=$((FAIL+1))
  fi
done

printf "\n%s passed · %s failed\n" "$PASS" "$FAIL"
[ "$FAIL" = "0" ]
