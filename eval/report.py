"""results.jsonl → 판정 비교표. 정답은 운영자 최종 상태(approved/rejected)."""
import json
from pathlib import Path
from statistics import median

import sys
rows = [json.loads(l) for l in (Path(__file__).parent / "results" / sys.argv[1]).open()]
ok = [r for r in rows if not r["error"]]
print(f"총 {len(rows)}장, 실패 {len(rows) - len(ok)}장")
pos = lambda r: r["label"] == "approved"


def conf(pred):
    tp = sum(1 for r in ok if pred(r) and pos(r)); fp = sum(1 for r in ok if pred(r) and not pos(r))
    fn = sum(1 for r in ok if not pred(r) and pos(r)); tn = sum(1 for r in ok if not pred(r) and not pos(r))
    return tp, fp, fn, tn


def show(name, pred):
    tp, fp, fn, tn = conf(pred)
    n = tp + fp + fn + tn
    print(f"\n[{name}] 정확도 {(tp + tn) / n:.1%} ({tp + tn}/{n})")
    print(f"  정답 공개 {tp + fn}장 중 공개로 맞춤 {tp}, 반려로 틀림 {fn}")
    print(f"  정답 반려 {fp + tn}장 중 반려로 맞춤 {tn}, 공개로 틀림 {fp}  ← 허위 제보가 새는 쪽")


show("jev verdict 질문", lambda r: r["verdict"] == "publish")
show("jev 조합 규칙: shark>0.5 이고 source=camera_photo", lambda r: r["shark_p"] > 0.5 and r["source"] == "camera_photo")
show("다수결 기준선: 전부 공개", lambda r: True)

# Claude: 자동 결정한 것만 맞았는지, 나머지는 사람에게 감
auto = [r for r in ok if r["claude_verdict"] in ("pass", "reject")]
right = sum(1 for r in auto if (r["claude_verdict"] == "pass") == pos(r))
print(f"\n[Claude 기존] 자동 결정 {len(auto)}/{len(ok)}장, 그중 맞음 {right} ({right / max(1, len(auto)):.1%}), 나머지 {len(ok) - len(auto)}장은 사람")

# jev 확률 임계값별: 자동 처리 비율과 그 안의 정확도 (Claude의 0.8 운영 방식과 같은 조건)
print("\n[jev verdict 확률 임계값별] 둘 중 큰 확률이 t 이상이면 자동, 아니면 사람")
for t in (0.5, 0.6, 0.7, 0.8, 0.9, 0.95):
    a = [r for r in ok if max(r["verdict_p"].values()) >= t]
    c = sum(1 for r in a if (r["verdict"] == "publish") == pos(r))
    print(f"  t={t:.2f}  자동 {len(a):3d}장 ({len(a) / len(ok):.0%})  정확도 {c / max(1, len(a)):.1%}")

print("\n[source 질문 분포] 정답별")
for lab in ("approved", "rejected"):
    d = {}
    for r in ok:
        if r["label"] == lab: d[r["source"]] = d.get(r["source"], 0) + 1
    print(f"  {lab}: {d}")

print("\n[반려 14장 상세]")
for r in ok:
    if r["label"] == "rejected":
        print(f"  {r['id']} jev={r['verdict']} p_pub={r['verdict_p']['publish']:.2f} src={r['source']} "
              f"shark={r['shark_p']:.2f} claude={r['claude_verdict']}")

tv = [r for r in rows if r["id"] == "s136"]
if tv:
    r = tv[0]
    print(f"\n[TV 캡처 s136] 정답 {r['label']} / jev {r['verdict']} {r['verdict_p']} / "
          f"source {r['source']} {r['source_p']} / shark {r['shark_p']:.2f} / Claude {r['claude_verdict']} {r['claude_conf']}")

ms = [r["engine_ms"] for r in ok]; wall = [r["wall_ms"] for r in ok]
print(f"\n[속도] 엔진 중앙값 {median(ms):.0f}ms, 최대 {max(ms):.0f}ms / 실측 중앙값 {median(wall):.0f}ms / "
      f"피크 메모리 {max(r['peak_gb'] for r in ok):.2f}GB")
