"""
같은 모델(Qwen3.5-4B-4bit), 같은 맥미니, 같은 146장으로 "답을 꺼내는 방식"만 바꿔 비교한다.

  J   Jev 방식: 레포 Engine.judge (보기 점수 판독, 생성 0). 프롬프트 v2. 판정 p(공개)≥0.7 공개 / ≤0.3 반려 / 사이 사람
  G1  생성 방식, 같은 질문: 레포 benchmarks/run.py 의 generate_json 을 그대로 호출.
      같은 v2 맥락·질문을 JSON으로 답하게 한다(보기 ID만, 확신도 없음). temperature 0.
  G2  생성 방식, 원래 운영 방식 재현: 운영에서 Claude에 쓰던 프롬프트(claude_prompt_prod.txt, 커밋 3fc7511)
      그대로 JSON(실사진·상어·사람·확신도·이유)을 생성하게 하고, 운영 decide() 규칙(확신도≥0.8)으로 판정.
      이 조건은 레포에 없는 것으로 이 실험에서 추가했다. 생성 설정은 G1과 같게(temperature 0, mlx_vlm.generate).

- 이미지 전처리는 세 조건 모두 레포 read_image(768px) 동일.
- 정답: 평가 기준 146장(운영자 최종 판정). 운영 DB는 읽지 않고 기존 결과 파일의 라벨을 쓴다.
- 레포 코드는 수정하지 않는다.
"""
import json, re, sys, time, hashlib
import os
from pathlib import Path

D = Path(__file__).parent
REPO = Path(os.environ.get("JEV_VISUAL_DIR", D / "jev-visual"))  # jev-visual 클론 위치
sys.path.insert(0, str(REPO)); sys.path.insert(0, str(D))
from jev_visual import Request                       # noqa: E402
from jev_visual.engine import Engine                 # noqa: E402
from jev_visual.preprocessing import read_image      # noqa: E402
from benchmarks.run import generate_json             # noqa: E402  레포의 생성 기준선
from prompts import PROMPTS, QUESTIONS_BY_PROMPT     # noqa: E402

DATA = Path(os.environ.get("BUKANG_DATA", Path.home() / "bukang"))  # 운영 데이터 폴더 (DB + photos)
PHOTOS = DATA / "photos"
OUT = D / "results" / "results_compare_generate.jsonl"
CLAUDE_PROMPT = (D / "claude_prompt_prod.txt").read_text()
PASS_CONF = 0.8   # 운영 decide() 기준


def decide(v):   # 운영 screener.js decide() 그대로 옮김
    if (v.get("confidence") or 0) < PASS_CONF: return "unsure"
    if v.get("photo") is False: return "reject"
    if not v.get("shark"): return "reject"
    return "pass"


def generate_prod_style(engine, image_path):
    from mlx_vlm import generate
    mx = engine.mx
    engine.adapter.reset()
    t = time.perf_counter()
    image = read_image(str(image_path))
    prompt = engine.processor.apply_chat_template(
        [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": CLAUDE_PROMPT}]}],
        tokenize=False, add_generation_prompt=True, enable_thinking=False)
    out = generate(engine.model, engine.processor, prompt, image=[image],
                   max_tokens=160, temperature=0.0, verbose=False, prefill_step_size=512)
    mx.synchronize()
    ms = (time.perf_counter() - t) * 1000
    v, err = None, None
    try:
        m = re.search(r"\{[\s\S]*\}", out.text or "")
        if not m: raise ValueError("JSON 없음")
        v = json.loads(m.group(0))
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
    return {"text": out.text, "parsed": v, "error": err, "verdict": decide(v) if v else "error",
            "ms": ms, "gen_tokens": out.generation_tokens, "prompt_sha": hashlib.sha256(prompt.encode()).hexdigest()[:12]}


def main():
    base = [json.loads(l) for l in open(D / "results" / "results_Qwen3.5-0.8B-4bit_v1.jsonl")]
    ids = [(r["id"], r["label"]) for r in base]
    # 사진 경로는 기존 결과에 없으니 평가 때와 같은 방식(DB 읽기 전용)으로 찾는다
    import sqlite3
    con = sqlite3.connect(f"file:{DATA / 'bukang.db'}?mode=ro", uri=True)
    photo = dict(con.execute("SELECT id, photo FROM submissions").fetchall())

    engine = Engine(str(REPO / ".models" / "Qwen3.5-4B-4bit"))
    state, questions = PROMPTS["v2"], QUESTIONS_BY_PROMPT["v2"]
    # 워밍업(시간 제외): 세 경로 모두 한 번씩
    w = PHOTOS / photo[ids[0][0]]
    engine.judge(Request(image=str(w), state=state, questions=questions))
    generate_json(engine, Request(image=str(w), state=state, questions=questions))
    generate_prod_style(engine, w)

    done = {json.loads(l)["id"] for l in OUT.open()} if OUT.exists() else set()
    with OUT.open("a") as f:
        for n, (sid, label) in enumerate(ids, 1):
            if sid in done: continue
            path = PHOTOS / photo[sid]
            req = Request(image=str(path), state=state, questions=questions)
            t = time.perf_counter(); j = engine.judge(req); j_ms = (time.perf_counter() - t) * 1000
            g1 = generate_json(engine, req)
            g2 = generate_prod_style(engine, path)
            pp = j["answers"]["verdict"]["probabilities"]["publish"]
            rec = {"id": sid, "label": label,
                   "J": {"p_pub": pp, "verdict": "pass" if pp >= 0.7 else ("reject" if pp <= 0.3 else "unsure"),
                         "choice": j["answers"]["verdict"]["choice"], "ms": j_ms, "gen_tokens": 0},
                   "G1": {"valid": g1["valid"], "parsed": g1["parsed_json"], "raw": g1["raw_text"][:300],
                          "ms": g1["metrics"]["elapsed_ms"], "gen_tokens": g1["metrics"]["generated_tokens"],
                          "hit_limit": g1["hit_token_limit"]},
                   "G2": {k: g2[k] for k in ("verdict", "parsed", "error", "ms", "gen_tokens")} | {"raw": (g2["text"] or "")[:300]}}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n"); f.flush()
            print(f"[{n}/{len(ids)}] {sid} {label} | J {rec['J']['verdict']} {j_ms:.0f}ms | "
                  f"G1 {'ok' if g1['valid'] else 'INVALID'} {g1['metrics']['elapsed_ms']:.0f}ms {g1['metrics']['generated_tokens']}tok | "
                  f"G2 {g2['verdict']} {g2['ms']:.0f}ms {g2['gen_tokens']}tok", flush=True)


if __name__ == "__main__":
    main()
