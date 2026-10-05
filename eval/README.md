**English** | [한국어](README.ko.md)

# AI Photo Screening Evaluation (eval/)

Before switching the production photo screening from a general-purpose LLM (Claude CLI) to a local scoring model, we compared the candidates on **146 real production reports**. This is the record of that comparison.
Ground truth is the state the operator finally confirmed (`approved` = approved, `rejected` = rejected).

## Why we switched
- General-purpose LLM screening took 11.4 seconds per photo, and when the personal subscription account's login expired, screening stopped without showing any error.
- Moving to the API would mean an ongoing per-photo cost.
- So we evaluated running a Jev-style scoring approach ([jev-visual](https://github.com/hr98w/jev-visual)), which "scores only the logits of the candidate answers 'approve' and 'reject' instead of generating text", directly on the Mac mini.

## Evaluation principles
- **Pinned before running:** The prompts (`prompts.py`) and comparison scripts were pinned with a commit before running, and every result file records `prompts_sha` (a hash of the prompt file).
- **The production DB is opened read-only.**
- **Measuring position bias:** `v2r` is identical to `v2` except that the order of the options is reversed.

## Key results (`reports/`)

| Comparison | Result | File |
|---|---|---|
| Model size (threshold 0.8) | 0.8B auto-rejected 0 of the 14 photos that should be rejected → adopted 4B (4B v2: 9/14, 0 false approvals) | `report_Qwen3.5-*.txt`, `compare.txt` |
| Threshold 0.7 (publish probability ≥0.7 auto-approve, ≤0.3 auto-reject, in between goes to a human) | Automated 101/146 (69.2%), accuracy of automated decisions 101/101, 0 false approvals | `quant_4b_v2_t07.txt` |
| Threshold cross-validation (5 folds × 200 runs) | On unseen photos: 76.6% automated, 1.09% error among automated, 0 false approvals | `quant_4b_v2_t07.txt` |
| Logit scoring vs plain generation (same 4B, same 146 photos) | Median 2.22s vs 4.34s, format errors 0/146 vs 86/146 | `report_J_vs_G1.txt` |
| Pre-deploy re-screening on a test server (147 photos) | Verdicts matched the evaluation 147/147, median 2.24s per photo | `servertest_report.txt` |

Limitation: there are only 14 negatives (photos that should be rejected), so the 95% upper bound on "the rate at which a false report scores above 0.7" is about 19% (`quant_4b_v2_t07.txt`, section 2). That's why, in production, every automated decision is sent to Discord so a human can overturn it.

Re-checked in production (242 reports since the 9/28 switch, not used in this evaluation, as of 2026-10-05): 87% automated, 0 automated decisions overturned by a human. Ground truth here is "not overturned by a human", so it is an operating record, not an independent label.

## To re-run

```bash
# 1) Fetch jev-visual at the commit used in the evaluation (do not modify the code)
git clone https://github.com/hr98w/jev-visual eval/jev-visual
git -C eval/jev-visual checkout 4382bba455647400951429134ceb012ca155e3fe
# Set up the virtualenv and model following the install steps in the jev-visual README (requires Apple Silicon + MLX)

# 2) Point to the production data folder (DB + photos) and run
export BUKANG_DATA=~/bukang            # where bukang.db and photos/ live
python eval/run_eval.py --model Qwen3.5-4B-4bit --prompt v2
python eval/report.py results_Qwen3.5-4B-4bit_v2.jsonl
```

Environment variables: `BUKANG_DATA` (default `~/bukang`), `JEV_VISUAL_DIR` (default `eval/jev-visual`).
Results accumulate in `eval/results/`, one line per photo; photos that already have a verdict are skipped.

## Privacy
- Report photos and the production DB are not in this repo.
- Report IDs in `results/` and `reports/` have been replaced with anonymous numbers (`s001`–`s147`). The mapping to real IDs is not published.
