"""
부캉이 제보 사진 146장을 jev-visual(Qwen3.5-0.8B-4bit, 레포 기본값)로 판정한다.

- 레포 코드는 수정하지 않는다. docs/usage.md에 문서화된 Python API
  (jev_visual.Request, jev_visual.engine.Engine.judge)를 그대로 호출한다.
- 정답 라벨: submissions.status (approved=공개, rejected=반려). 운영자가 최종 확정한 상태.
- 운영 DB는 읽기 전용으로 연다.
- 결과: results.jsonl (한 장당 한 줄), 요약은 report.py가 만든다.
"""
import json, sqlite3, sys, time, os
from pathlib import Path

REPO = Path(os.environ.get("JEV_VISUAL_DIR", Path(__file__).parent / "jev-visual"))  # jev-visual 클론 위치
sys.path.insert(0, str(REPO))
from jev_visual import Request            # noqa: E402
from jev_visual.engine import Engine      # noqa: E402

DATA = Path(os.environ.get("BUKANG_DATA", Path.home() / "bukang"))  # 운영 데이터 폴더 (DB + photos)
DB = DATA / "bukang.db"
PHOTOS = DATA / "photos"

from prompts import PROMPTS, QUESTIONS_BY_PROMPT  # noqa: E402
import argparse, hashlib  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="Qwen3.5-0.8B-4bit")
    ap.add_argument("--prompt", default="v1", choices=list(PROMPTS))
    args = ap.parse_args()
    STATE = PROMPTS[args.prompt]
    QUESTIONS = QUESTIONS_BY_PROMPT[args.prompt]
    OUT = Path(__file__).parent / "results" / f"results_{args.model}_{args.prompt}.jsonl"
    psha = hashlib.sha256((Path(__file__).parent / "prompts.py").read_bytes()).hexdigest()[:12]
    print(f"model={args.model} prompt={args.prompt} prompts.py sha={psha} out={OUT.name}", flush=True)
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rows = con.execute("""
        SELECT s.id, s.status, s.photo, c.verdict, c.confidence
        FROM submissions s LEFT JOIN screening c ON c.id = s.id
        WHERE s.status IN ('approved','rejected')
        ORDER BY s.submitted_at""").fetchall()
    done = set()
    if OUT.exists():
        done = {json.loads(l)["id"] for l in OUT.open()}
    print(f"{len(rows)} images, {len(done)} already done", flush=True)

    engine = Engine(str(REPO / ".models" / args.model))
    with OUT.open("a") as f:
        for i, (sid, status, photo, cv, cc) in enumerate(rows, 1):
            if sid in done:
                continue
            path = PHOTOS / photo
            t0 = time.perf_counter()
            try:
                r = engine.judge(Request(image=str(path), state=STATE, questions=QUESTIONS))
                err = None
            except Exception as e:                       # 실패도 기록한다
                r, err = None, f"{type(e).__name__}: {e}"
            wall = (time.perf_counter() - t0) * 1000
            rec = {"model": args.model, "prompt": args.prompt, "prompts_sha": psha, "id": sid, "label": status, "claude_verdict": cv, "claude_conf": cc,
                   "wall_ms": round(wall, 1), "error": err}
            if r:
                a = r["answers"]
                rec.update({
                    "verdict": a["verdict"]["choice"], "verdict_p": a["verdict"]["probabilities"],
                    "source": a["source"]["choice"], "source_p": a["source"]["probabilities"],
                    "shark_p": a["shark"]["noul"],
                    "engine_ms": round(r["metrics"]["elapsed_ms"], 1),
                    "peak_gb": round(r["metrics"]["peak_metal_memory_gb"], 2),
                })
            f.write(json.dumps(rec, ensure_ascii=False) + "\n"); f.flush()
            print(f"[{i}/{len(rows)}] {sid} label={status} jev={rec.get('verdict')} "
                  f"p={rec.get('verdict_p')} src={rec.get('source')} {wall:.0f}ms {err or ''}", flush=True)


if __name__ == "__main__":
    main()
