[English](README.md) | **한국어**

# AI 사진 심사 평가 (eval/)

운영 중이던 사진 심사를 범용 LLM(Claude CLI)에서 로컬 판정 모델로 바꾸기 전에, **실제 운영 제보 146장**으로 후보를 비교한 기록입니다.
정답은 운영자가 최종 확정한 상태(`approved`=공개, `rejected`=반려)입니다.

## 왜 바꿨나
- 범용 LLM 심사는 사진 한 장에 11.4초가 걸렸고, 개인 구독 계정의 로그인이 만료되자 오류 표시 없이 심사가 멈췄습니다.
- API로 옮기면 장당 비용이 계속 나갑니다.
- 그래서 "문장을 생성하지 않고, '공개'와 '반려' 후보 답의 logit만 채점하는" 방식([jev-visual](https://github.com/hr98w/jev-visual))을 맥미니에서 직접 돌리는 안을 평가했습니다.

## 평가 원칙
- **실행 전에 고정:** 프롬프트(`prompts.py`)와 비교 스크립트는 실행 전에 커밋으로 고정했고, 결과 파일마다 `prompts_sha`(프롬프트 파일 해시)를 남겼습니다.
- **운영 DB는 읽기 전용으로** 엽니다.
- **위치 편향 측정:** `v2r`은 `v2`와 같고 보기 순서만 뒤집은 버전입니다.

## 주요 결과 (`reports/`)

| 비교 | 결과 | 파일 |
|---|---|---|
| 모델 크기 (기준선 0.8) | 0.8B는 반려해야 할 14장 중 자동 반려 0장 → 4B 채택 (4B v2는 9/14, 허위 공개 0) | `report_Qwen3.5-*.txt`, `compare.txt` |
| 기준선 0.7 (공개 확률 ≥0.7 자동 공개, ≤0.3 자동 반려, 사이는 사람) | 자동 처리 101/146 (69.2%), 자동 판정 정확도 101/101, 허위 공개 0 | `quant_4b_v2_t07.txt` |
| 기준선 교차검증 (5묶음 × 200회) | 처음 보는 사진 기준 자동 76.6%, 자동 중 오류 1.09%, 허위 공개 0 | `quant_4b_v2_t07.txt` |
| 로짓 채점 vs 일반 생성 (같은 4B, 같은 146장) | 중앙값 2.22초 vs 4.34초, 형식 오류 0/146 vs 86/146 | `report_J_vs_G1.txt` |
| 배포 전 테스트 서버 재심사 (147장) | 평가 결과와 판정 147/147 일치, 한 장 중앙값 2.24초 | `servertest_report.txt` |

한계: 반려 표본이 14장뿐이라, "허위 제보가 0.7을 넘을 비율"의 95% 상한은 약 19%입니다(`quant_4b_v2_t07.txt` 2절). 그래서 운영에서는 모든 자동 판정을 디스코드로 받아 사람이 뒤집을 수 있게 했습니다.

운영에서 다시 본 결과(9/28 전환 이후, 이 평가에 쓰지 않은 제보 242장, 2026-10-05 기준): 자동 처리 87%, 사람이 뒤집은 자동 판정 0건. 정답은 "사람이 뒤집지 않음" 기준이라 독립 검증 라벨은 아닙니다.

## 다시 돌리려면

```bash
# 1) jev-visual을 평가에 쓴 커밋으로 받는다 (코드는 수정하지 않는다)
git clone https://github.com/hr98w/jev-visual eval/jev-visual
git -C eval/jev-visual checkout 4382bba455647400951429134ceb012ca155e3fe
# jev-visual README의 설치 절차대로 가상환경과 모델을 준비한다 (Apple Silicon + MLX 필요)

# 2) 운영 데이터 폴더(DB + photos)를 지정하고 실행한다
export BUKANG_DATA=~/bukang            # bukang.db 와 photos/ 가 있는 곳
python eval/run_eval.py --model Qwen3.5-4B-4bit --prompt v2
python eval/report.py results_Qwen3.5-4B-4bit_v2.jsonl
```

환경변수: `BUKANG_DATA`(기본 `~/bukang`), `JEV_VISUAL_DIR`(기본 `eval/jev-visual`).
결과는 `eval/results/`에 한 장당 한 줄로 쌓이고, 이미 판정한 장은 건너뜁니다.

## 개인정보
- 제보 사진과 운영 DB는 저장소에 없습니다.
- `results/`와 `reports/`의 제보 ID는 익명 번호(`s001`~`s147`)로 바꿨습니다. 실제 ID와의 대응표는 공개하지 않습니다.
