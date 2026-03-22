#!/usr/bin/env bash
# nvm 로드 → Node(.nvmrc) 적용 → 백엔드·프론트 동시 실행
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
else
  echo "❌ nvm을 찾을 수 없습니다. 설치: https://github.com/nvm-sh/nvm"
  exit 1
fi

nvm install
nvm use

echo "📦 의존성 설치 중…"
(cd "$ROOT/backend" && npm install)
(cd "$ROOT/frontend" && npm install)

echo "🚀 백엔드(4000) + 프론트(3000) 시작… (종료: Ctrl+C)"
trap 'kill 0' EXIT
(cd "$ROOT/backend" && npm run dev) &
(cd "$ROOT/frontend" && npm run dev) &
wait
