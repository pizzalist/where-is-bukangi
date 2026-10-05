[English](third-party.md) | **한국어**

# 외부 코드와 모델

이 저장소는 아래 외부 코드와 모델을 **내려받아 쓰지만, 그 코드나 가중치를 이 저장소에 포함하지 않습니다.**
설치 스크립트(`ops/jev/setup.sh`)와 평가 스크립트(`eval/`)가 각자의 공식 저장소에서 받아옵니다.

| 이름 | 쓰는 곳 | 라이선스 | 비고 |
|---|---|---|---|
| [jev-visual](https://github.com/hr98w/jev-visual) | AI 사진 심사 엔진 (`ops/jev/setup.sh`가 클론, `eval/`이 파이썬 API로 호출) | MIT (Copyright (c) 2026 Jev Visual contributors) | 커밋 `4382bba455647400951429134ceb012ca155e3fe`에 고정. 코드는 수정하지 않고 문서화된 API(`jev_visual.Request`, `Engine.judge`)와 HTTP 서버만 사용 |
| [OpenJev](https://github.com/TheoLeeCJ/openjev) | jev-visual이 참고한 원 구현 | MIT (Copyright 2026 TheoLeeCJ) | jev-visual의 `THIRD_PARTY.md`에 명시된 출처 |
| [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) / [MLX 4bit 변환본](https://huggingface.co/mlx-community/Qwen3.5-4B-4bit) | 운영 심사 모델 | Apache-2.0 (원 모델 카드) | 가중치는 설치 시 내려받음. 저장소 미포함 |
| [Qwen3.5-0.8B](https://huggingface.co/Qwen/Qwen3.5-0.8B) / MLX 4bit 변환본 | 평가 비교용 모델 | Apache-2.0 (원 모델 카드) | 동일 |
| npm 의존성 (`package.json`) | 화면과 서버 | 각 패키지의 라이선스 | `node_modules`는 저장소 미포함 |

## 참고한 기법 (코드는 가져오지 않음)
- **홀로 카드 효과** (`src/components/HoloCard.tsx`, `src/styles.css`): 포켓몬 카드 홀로 효과로 잘 알려진 [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) (GPL-3.0)의 접근을 참고했습니다.
  포인터 위치를 CSS 변수(회전 `--rx/--ry`, 포일 위치 `--posx/--posy`, 반사광 `--mx/--my`, 세기 `--hyp`)로 넘기고 그라디언트·blend mode를 겹치는 방식입니다.
  코드는 이 저장소에서 새로 작성했으며, 해당 저장소의 전체 기록(2026-09-30 확인)과 비교해 30자 이상 같은 줄은 `background-blend-mode: exclusion, hue, hard-light` 한 줄뿐입니다.

## "Jev"라는 이름에 대해
"Jev"는 TypeSafe의 비공개 모델 이름입니다. 이 프로젝트가 쓰는 jev-visual은 그 추론 방식(답을 생성하지 않고 후보 답의 logit만 채점)을
흉내 낸 **독립 커뮤니티 구현**이며, jev-visual 스스로도 TypeSafe Jev의 아키텍처나 학습을 재현하지 않는다고 밝힙니다.
이 저장소도 TypeSafe와 관련이 없습니다.

## 이 저장소 자체의 자산
- 부캉이 캐릭터 그림(`public/bukang-*.webp`): 제작자가 이미지 생성 AI로 만든 그림입니다.
- 시민이 올린 제보 사진과 운영 DB는 저장소에 포함하지 않습니다. `eval/`의 결과 파일은 제보 ID를 `s001`~`s147` 익명 번호로 바꿔 두었습니다.
