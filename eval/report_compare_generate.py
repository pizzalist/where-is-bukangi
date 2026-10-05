"""results_compare_generate.jsonl → 속도·정확도·형식 오류 비교표."""
import json, math
from pathlib import Path
from statistics import median

rows = [json.loads(l) for l in open(Path(__file__).parent / "results" / "results_compare_generate.jsonl")]
N = len(rows); pos = lambda r: r["label"] == "approved"
def pct(xs, q): xs = sorted(xs); return xs[min(len(xs) - 1, int(len(xs) * q))]
def wilson(k, n, z=1.96):
    if n == 0: return (0, 0)
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h

print(f"평가 {N}장 (공개 {sum(map(pos, rows))}, 반려 {N - sum(map(pos, rows))}) · 같은 Qwen3.5-4B-4bit · 같은 맥미니 · 연달아 실행\n")
print("1) 속도 (한 장, 워밍업 제외)")
for k, name in (("J", "J  Jev 판독"), ("G1", "G1 생성, 같은 질문"), ("G2", "G2 생성, 원래 운영 프롬프트")):
    ms = [r[k]["ms"] for r in rows]; tok = [r[k]["gen_tokens"] for r in rows]
    print(f"   {name:22s} 중앙값 {median(ms)/1000:.2f}초 · 90% {pct(ms,.9)/1000:.2f}초 · 최대 {max(ms)/1000:.2f}초 · 생성 토큰 중앙값 {median(tok):.0f}")

print("\n2) 형식 오류 (답을 코드가 못 읽은 경우)")
g1_bad = [r for r in rows if not r["G1"]["valid"]]
g2_bad = [r for r in rows if r["G2"]["verdict"] == "error"]
print(f"   J  0/{N} (구조상 불가능)")
print(f"   G1 {len(g1_bad)}/{N} ({len(g1_bad)/N:.1%})  · 그중 글자 수 한도에 걸림 {sum(r['G1']['hit_limit'] for r in g1_bad)}")
print(f"   G2 {len(g2_bad)}/{N} ({len(g2_bad)/N:.1%})")

print("\n3) 판정 정확도")
# 모두 자동으로 답하게 했을 때 (G1은 확신도가 없어 기준선 운영 불가)
jc = sum((r["J"]["choice"] == "publish") == pos(r) for r in rows)
g1v = [r for r in rows if r["G1"]["valid"]]
g1c = sum((r["G1"]["parsed"]["verdict"] == "publish") == pos(r) for r in g1v)
print(f"   전부 답하게 하면: J {jc}/{N} ({jc/N:.1%}) · G1 {g1c}/{len(g1v)} 유효 답 중 ({g1c/max(1,len(g1v)):.1%}), 무효 {N-len(g1v)}장은 답 없음")
# 운영 규칙대로 (자동/사람 분리)
for k, name in (("J", "J  (p≥0.7/≤0.3)"), ("G2", "G2 (자기보고 확신도≥0.8)")):
    a = [r for r in rows if r[k]["verdict"] in ("pass", "reject")]
    c = sum((r[k]["verdict"] == "pass") == pos(r) for r in a)
    fp = sum(1 for r in a if r[k]["verdict"] == "pass" and not pos(r))
    rj = sum(1 for r in a if r[k]["verdict"] == "reject" and not pos(r))
    lo, hi = wilson(c, len(a))
    print(f"   {name:24s} 자동 {len(a)}/{N} ({len(a)/N:.1%}) · 자동 중 정확도 {c}/{len(a)} ({c/max(1,len(a)):.1%}, 95% CI {lo:.1%}~{hi:.1%}) · 허위 공개 {fp} · 허위 자동 반려 {rj}/14 · 사람/오류 {N-len(a)}")

print("\n4) G2 자기보고 확신도의 분포 (생성형 확신도가 기준선으로 쓸 만한가)")
confs = [r["G2"]["parsed"].get("confidence") for r in rows if r["G2"]["parsed"] and isinstance(r["G2"]["parsed"].get("confidence"), (int, float))]
vals = {}
for c in confs: vals[round(c, 2)] = vals.get(round(c, 2), 0) + 1
print("   서로 다른 확신도 값", len(vals), "종류:", dict(sorted(vals.items(), key=lambda x: -x[1])[:8]))
ys = [pos(r) for r in rows if r["G2"]["parsed"] and isinstance(r["G2"]["parsed"].get("confidence"), (int, float))]
# 순위 품질: 공개 쪽 점수 = shark&photo면 conf, 아니면 1-conf
def g2score(r):
    p = r["G2"]["parsed"]; c = p.get("confidence") or 0
    return c if (p.get("shark") and p.get("photo") is not False) else 1 - c
def auc(scores, labels):
    P = [s for s, y in zip(scores, labels) if y]; Q = [s for s, y in zip(scores, labels) if not y]
    return sum((a > b) + 0.5 * (a == b) for a in P for b in Q) / (len(P) * len(Q))
ok2 = [r for r in rows if r["G2"]["parsed"] and isinstance(r["G2"]["parsed"].get("confidence"), (int, float))]
print(f"   AUROC  J {auc([r['J']['p_pub'] for r in rows], [pos(r) for r in rows]):.3f}  ·  G2 {auc([g2score(r) for r in ok2], [pos(r) for r in ok2]):.3f} (파싱된 {len(ok2)}장)")

tv = next(r for r in rows if r["id"] == "s136")
print(f"\n5) TV 캡처: J {tv['J']['verdict']} p={tv['J']['p_pub']:.2f} · G1 {tv['G1']['parsed'] if tv['G1']['valid'] else 'INVALID'} · G2 {tv['G2']['verdict']} {tv['G2']['parsed']}")
print("\n6) G1 무효 예시:", (g1_bad[0]["G1"]["raw"][:160] if g1_bad else "-").replace("\n", " "))
