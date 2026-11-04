#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTION="$SCRIPT_DIR/CORE.postman_collection.json"
ENVIRONMENT="$SCRIPT_DIR/CORE.local.postman_environment.json"
RESULTS="$SCRIPT_DIR/newman-results.json"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required. Install Node.js/npm first." >&2
  exit 1
fi

if [[ ! -f "$COLLECTION" || ! -f "$ENVIRONMENT" ]]; then
  echo "Postman collection or environment file is missing." >&2
  exit 1
fi

echo "Running CORE API route smoke collection."
echo "Mutations remain disabled unless runMutations is explicitly changed in the environment."
npx --yes newman run "$COLLECTION" \
  --environment "$ENVIRONMENT" \
  --reporters cli,json \
  --reporter-json-export "$RESULTS"

echo "Newman report: $RESULTS"
