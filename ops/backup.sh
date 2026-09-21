#!/bin/bash
# 사진·DB 백업. 주 1회 cron 권장.
set -euo pipefail
SRC="${BUKANG_DATA:-$HOME/bukang}"
DST="${1:-/Volumes/Backup/bukang}"
mkdir -p "$DST"
sqlite3 "$SRC/bukang.db" ".backup '$DST/bukang-$(date +%F).db'"
rsync -a --delete "$SRC/photos/" "$DST/photos/"
find "$DST" -name 'bukang-*.db' -mtime +30 -delete
echo "백업 완료: $DST ($(du -sh "$DST" | cut -f1))"
