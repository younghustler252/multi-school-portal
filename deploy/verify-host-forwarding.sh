#!/usr/bin/env bash
# Checks that the reverse proxy hands the API the ORIGINAL hostname (tenancy depends on it).
#
# It asks the API itself. GET /api/v1/health runs after the tenant resolver, and for an unknown school the resolver answers
#   404 SCHOOL_NOT_FOUND  "School portal '<what it saw>' not found"
# so the answer shows exactly which hostname the API received. No special endpoint and no database access are needed.
#
# Usage:   BASE_DOMAIN=example.com ./deploy/verify-host-forwarding.sh
# Optional: SCHEME=http PORT=8080 (local), PROXY_IP=1.2.3.4 (test before DNS exists), CUSTOM_DOMAIN=portal.some-school.edu
set -u
: "${BASE_DOMAIN:?set BASE_DOMAIN, for example BASE_DOMAIN=example.com}"
SCHEME="${SCHEME:-https}"; PORT="${PORT:-}"; ADMIN="${ADMIN_SUBDOMAIN:-admin}"
PROBE="zz-probe-$RANDOM"; fail=0

call() { # host -> prints "<status> <body>"
	local host="$1" hp="$1${PORT:+:$PORT}"
	local rport="${PORT:-$([ "$SCHEME" = https ] && echo 443 || echo 80)}"
	local resolve=(); [ -n "${PROXY_IP:-}" ] && resolve=(--resolve "$host:$rport:$PROXY_IP")
	curl -sS -m 15 "${resolve[@]}" -w ' %{http_code}' "$SCHEME://$hp/api/v1/health" 2>&1
}
check() { # name host expected-status must-contain
	local out; out="$(call "$2")"; local code="${out##* }"; local body="${out% *}"
	if [ "$code" = "$3" ] && { [ -z "$4" ] || printf '%s' "$body" | grep -q -- "$4"; }; then echo "PASS  $1"
	else echo "FAIL  $1  (got HTTP $code: ${body:0:160})"; fail=1; fi
}

check "unknown school subdomain reaches the API with its own label"  "$PROBE.$BASE_DOMAIN"   404 "School portal '$PROBE' not found"
check "platform root is served as the platform"                       "$BASE_DOMAIN"           200 ""
check "admin host is served as the platform"                          "$ADMIN.$BASE_DOMAIN"    200 ""
check "www is served as the platform"                                 "www.$BASE_DOMAIN"       200 ""
[ -n "${CUSTOM_DOMAIN:-}" ] && check "custom domain reaches the API with its own hostname" "$CUSTOM_DOMAIN" 404 "School portal '$CUSTOM_DOMAIN' not found"

if [ $fail -eq 0 ]; then echo "OK: the API receives the original Host."; else
	echo "NOT OK. If a FAIL shows the upstream's own name (127.0.0.1, localhost, an internal hostname) the proxy is replacing Host."; fi
exit $fail
