"""4개 조건을 같은 146장(0.8B v1 실행 시점의 라벨 세트)으로 비교. 임계값 0.8은 운영 Claude와 같은 값으로 미리 정한 것."""
import json
from pathlib import Path
from statistics import median
D = Path(__file__).parent
base = [json.loads(l) for l in open(D / "results" / "results_Qwen3.5-0.8B-4bit_v1.jsonl")]
ids = {r["id"]: r["label"] for r in base}
conds = [("0.8B", "v1"), ("0.8B", "v2"), ("4B", "v1"), ("4B", "v2")]
T = 0.8
print(f"공통 세트 {len(ids)}장 (공개 {sum(v=='approved' for v in ids.values())}, 반려 {sum(v=='rejected' for v in ids.values())}), 자동 처리 임계값 {T}\n")
print("조건        | 최대확률 정확도 | 자동처리(≥0.8) | 자동 중 정확도 | 반려 자동처리 | 허위 공개 | TV캡처 판정 (p공개, 출처) | 중앙 ms")
rows_all = {}
for m, p in conds:
    rs = [json.loads(l) for l in open(D / "results" / f"results_Qwen3.5-{m}-4bit_{p}.jsonl")]
    rs = [r for r in rs if r["id"] in ids and not r["error"]]
    for r in rs: r["label"] = ids[r["id"]]
    rows_all[(m, p)] = {r["id"]: r for r in rs}
    pos = lambda r: r["label"] == "approved"
    acc = sum((r["verdict"] == "publish") == pos(r) for r in rs) / len(rs)
    auto = [r for r in rs if max(r["verdict_p"].values()) >= T]
    aacc = sum((r["verdict"] == "publish") == pos(r) for r in auto) / max(1, len(auto))
    rej_auto = sum(1 for r in auto if r["verdict"] == "reject" and not pos(r))
    false_pub = sum(1 for r in auto if r["verdict"] == "publish" and not pos(r))
    tv = next(r for r in rs if r["id"] == "s136")
    print(f"{m:4} {p}     | {acc:6.1%}          | {len(auto):3d} ({len(auto)/len(rs):.0%})      | {aacc:6.1%}        | {rej_auto:2d}/14         | {false_pub:2d}        | {tv['verdict']} {tv['verdict_p']['publish']:.2f}, {tv['source']} {tv['source_p'][tv['source']]:.2f} | {median(r['engine_ms'] for r in rs):.0f}")
    wrong = [(r["id"], r["label"][:3], r["verdict"], round(max(r["verdict_p"].values()), 2)) for r in auto if (r["verdict"] == "publish") != pos(r)]
    rows_all[(m, p)]["_wrong"] = wrong
print("\n자동 처리 중 틀린 것:")
for k, v in rows_all.items(): print(" ", k, v["_wrong"])
print("\n반려 14장 p(공개) 비교:")
for i, l in ids.items():
    if l == "rejected":
        print(f"  {i}", "  ".join(f"{m}{p}:{rows_all[(m,p)][i]['verdict_p']['publish']:.2f}/{rows_all[(m,p)][i]['source'][:6]}" for m, p in conds))
print("\n출처 판정(정답 반려 14장): screen/art/screenshot로 본 수")
for k in conds:
    print(" ", k, sum(1 for i, l in ids.items() if l == "rejected" and rows_all[k][i]["source"] != "camera_photo"), "/ 공개 132장 중 비카메라로 본 수", sum(1 for i, l in ids.items() if l == "approved" and rows_all[k][i]["source"] != "camera_photo"))
cl = [r for r in base if r["claude_verdict"] in ("pass", "reject")]
print(f"\nClaude 기존: 자동 {len(cl)} ({len(cl)/len(base):.0%}), 자동 중 정확도 {sum((r['claude_verdict']=='pass')==(r['label']=='approved') for r in cl)/len(cl):.1%}, 반려 자동처리 {sum(1 for r in cl if r['claude_verdict']=='reject' and r['label']=='rejected')}/14, 허위 공개 {sum(1 for r in cl if r['claude_verdict']=='pass' and r['label']=='rejected')}, TV캡처 unsure 0.75, 약 13000ms")
