#!/bin/bash
# 개발·검증용 로컬 실행
set -euo pipefail
cd "$(dirname "$0")/.."
export BUKANG_DATA="${BUKANG_DATA:-$HOME/bukang}"
export ADMIN_TOKEN="${ADMIN_TOKEN:-$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")}"
echo "ADMIN_TOKEN=$ADMIN_TOKEN"
npm run build
exec node server/index.js
