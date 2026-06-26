#!/usr/bin/env bash
# Print Amplify environment variables from Terraform outputs (after apply).
# Usage: ./scripts/print-amplify-env.sh [dev|staging|prod]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/infra/terraform"
ENV="${1:-dev}"

cd "$TF_DIR"

VAR_FILE=""
if [[ "$ENV" != "dev" ]]; then
  VAR_FILE="-var-file=environments/${ENV}.tfvars"
fi

if ! terraform output -json amplify_environment_variables &>/dev/null; then
  echo "Run terraform apply first (env: $ENV)." >&2
  exit 1
fi

echo "# Amplify environment variables for: $ENV"
echo "# Also set AUTH_SESSION_SECRET to a long random string (Amplify → Secrets)."
echo ""

terraform output -json amplify_environment_variables | python3 -c "
import json, sys
data = json.load(sys.stdin)
for k, v in sorted(data.items()):
    print(f'{k}={v}')
"

echo ""
echo "# After Amplify deploy, add the app URL to web_app_origins in environments/${ENV}.tfvars and re-apply for CORS."
