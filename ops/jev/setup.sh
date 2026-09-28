#!/bin/zsh
# jev 심사 엔진 설치 (맥미니, Apple Silicon 전용)
#
# 하는 일
#   1) jev-visual 레포를 고정 커밋으로 받는다 (코드 수정 없음)
#   2) 레포 README 절차대로 Python 3.13 가상환경과 고정 의존성을 설치한다
#   3) Qwen3.5-4B-4bit 모델을 고정 버전으로 받는다 (레포 기본은 0.8B, 4B는 평가로 선택)
#   4) 상시 실행 설정(launchd)을 설치하고 켠다. 127.0.0.1:8788 에서만 듣는다 (외부 비공개)
#
# 여러 번 실행해도 된다. 이미 받은 것은 건너뛴다.
# 되돌리기: launchctl bootout gui/$(id -u)/kr.bukangi.jev && 서버 설정의 SCREEN_ENGINE을 claude로
set -euo pipefail

JEV_HOME="${JEV_HOME:-$HOME/bukang-jev}"
REPO_URL="https://github.com/hr98w/jev-visual.git"
REPO_COMMIT="4382bba455647400951429134ceb012ca155e3fe"        # 2026-09-21, 평가에 쓴 커밋
MODEL_ID="mlx-community/Qwen3.5-4B-4bit"
MODEL_REVISION="0e7ffd5c629ef7719d4cbc04069232580bfa9d9c"     # 평가에 쓴 버전
PORT="${JEV_PORT:-8788}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[[ "$(uname -m)" == "arm64" ]] || { echo "FAIL: Apple Silicon 전용"; exit 1; }
command -v uv >/dev/null || { echo "FAIL: uv가 없다. brew install uv"; exit 1; }

mkdir -p "$JEV_HOME"
if [[ ! -d "$JEV_HOME/jev-visual/.git" ]]; then
  git clone -q "$REPO_URL" "$JEV_HOME/jev-visual"
fi
cd "$JEV_HOME/jev-visual"
git fetch -q origin && git checkout -q "$REPO_COMMIT"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo "FAIL: jev-visual 코드가 수정돼 있다"; exit 1; }

# 레포 README 절차 그대로
[[ -d .venv ]] || uv venv -q --python 3.13
uv pip install -q --python .venv/bin/python -r requirements-lock.txt
uv pip install -q --python .venv/bin/python --no-deps -e .

MODEL_DIR="$JEV_HOME/models/Qwen3.5-4B-4bit"
if [[ ! -f "$MODEL_DIR/config.json" ]]; then
  .venv/bin/python - "$MODEL_ID" "$MODEL_REVISION" "$MODEL_DIR" <<'PY'
import sys
from huggingface_hub import snapshot_download
# 레포 download.py와 같은 파일 규칙, 모델 이름과 버전만 다르다
snapshot_download(sys.argv[1], revision=sys.argv[2], local_dir=sys.argv[3],
                  allow_patterns=["*.json", "*.jinja", "*.safetensors"])
PY
fi

# launchd
PLIST="$HOME/Library/LaunchAgents/kr.bukangi.jev.plist"
sed -e "s#__JEV_HOME__#$JEV_HOME#g" -e "s#__PORT__#$PORT#g" -e "s#__LOG_DIR__#${BUKANG_DATA:-$HOME/bukang}/logs#g" \
  "$HERE/kr.bukangi.jev.plist" > "$PLIST"
launchctl bootout "gui/$(id -u)/kr.bukangi.jev" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "모델 올리는 중 (처음 20초 안팎)…"
for _ in {1..120}; do
  curl -s "http://127.0.0.1:$PORT/health" | grep -q '"ready":true' && { echo "jev 준비됨: http://127.0.0.1:$PORT"; exit 0; }
  sleep 1
done
echo "FAIL: 120초 안에 준비되지 않았다. 로그: ${BUKANG_DATA:-$HOME/bukang}/logs/jev.err.log"; exit 1
