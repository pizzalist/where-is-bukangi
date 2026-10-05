"""
프롬프트 버전 관리. v2는 결과를 보기 전에 고정하고 한 번만 실행한다.

v1 → v2 에서 바뀌는 것은 STATE(맥락 문장) 하나뿐이다. QUESTIONS는 v1과 완전히 같다.
그래야 결과 차이를 "가이드를 줬는지" 하나로 설명할 수 있다.

순환성 방지 원칙
- 146장 중 특정 사진의 내용(피사체, 장면, 자막 문구 등)을 묘사하지 않는다.
- "화면·영상 캡처, 그림·카드는 실제 목격이 아니다"는 v1과 기존 Claude 심사 프롬프트
  (server/screener.js)에 이미 있던 서비스 규칙이다. v2는 그 규칙을 알아보는 일반적인
  시각 단서(화면 테두리, 모아레, 자막·로고 등 오버레이)만 덧붙인다.
- "물가 장면이 아니면 목격이 아니다"도 v1 반려 기준에 있던 규칙이다. v2는 원칙만
  쓰고 사물 종류를 나열하지 않는다.
- 공개(실제 목격) 쪽도 같은 수준으로 설명해 한쪽으로 기울지 않게 한다.
"""

STATE_V1 = ("This photo was submitted to a citizen sighting board for a shark that is staying "
            "in a waterway at Busan North Port Waterfront Park. Judge only what is visible.")

STATE_V2 = (
    "This photo was submitted to a citizen sighting board for a shark that is staying "
    "in a waterway at Busan North Port Waterfront Park. Judge only what is visible.\n"
    "\n"
    "A genuine sighting is a photo taken on site, directly with a camera, of the waterway. "
    "Such photos show water, usually seen from a railing, deck or stone edge. The water is "
    "often green or murky, so the shark may appear only as a dark elongated shape, a fin, "
    "its back or a shadow. A blurry shape in real water can still be a genuine sighting.\n"
    "\n"
    "The following are NOT genuine sightings and must not be published, even if a shark is "
    "clearly visible in them, because the person did not see the shark on site:\n"
    "- A photo of a screen: a TV, monitor, laptop or phone display. Typical signs are visible "
    "screen edges or bezels, moire or pixel-grid patterns, reflections on glass, and "
    "overlaid text or graphics such as captions, subtitles, channel logos, news tickers, "
    "timestamps or app interface elements.\n"
    "- A screenshot or a frame saved from a video, news broadcast, website or social media.\n"
    "- A drawing, illustration, cartoon, sticker, card, printed image or meme.\n"
    "\n"
    "A photo that does not show the waterway at all is not a sighting."
)

QUESTIONS = {
    "verdict": {
        "type": "choice",
        "instructions": "Should this submission be published as a real sighting of the shark?",
        "criteria": {
            "publish": "Yes: a real camera photo of the water or waterfront in which a shark, or its fin, back or shadow, is visible",
            "reject": "No: no shark is visible, or it is not a real camera photo (screenshot, photo of a TV or screen, video capture, drawing, card or meme)",
        },
    },
    "source": {
        "type": "choice",
        "instructions": "What kind of image is this?",
        "criteria": {
            "camera_photo": "A photo taken directly with a camera of a real scene",
            "screen_capture": "A photo of a TV, monitor or phone screen, or a frame captured from a video or news broadcast",
            "screenshot": "A screenshot of an app, website or social media",
            "artwork": "A drawing, illustration, trading card, sticker or meme",
        },
    },
    "shark": {
        "type": "noul",
        "instructions": "Is a shark, or its fin, back or shadow, visible in real water?",
    },
}

PROMPTS = {"v1": STATE_V1, "v2": STATE_V2, "v2r": STATE_V2}

# v2r: 맥락 글은 v2와 같고, 판정 질문의 보기 순서만 뒤집는다 (반려=A, 공개=B).
# 레포(jev-visual)는 보기 순서를 섞지 않으므로, 위치 편향을 재기 위한 조건이다.
import copy as _copy
QUESTIONS_REVERSED = _copy.deepcopy(QUESTIONS)
QUESTIONS_REVERSED["verdict"]["criteria"] = dict(reversed(list(QUESTIONS["verdict"]["criteria"].items())))
QUESTIONS_BY_PROMPT = {"v1": QUESTIONS, "v2": QUESTIONS, "v2r": QUESTIONS_REVERSED}
