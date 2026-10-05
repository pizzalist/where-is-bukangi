**English** | [한국어](third-party.ko.md)

# Third-party code and models

This repository **downloads and uses the external code and models below, but does not include their code or weights in this repository.**
The install script (`ops/jev/setup.sh`) and the evaluation scripts (`eval/`) fetch them from their respective official repositories.

| Name | Used for | License | Notes |
|---|---|---|---|
| [jev-visual](https://github.com/hr98w/jev-visual) | AI photo screening engine (cloned by `ops/jev/setup.sh`, called via its Python API from `eval/`) | MIT (Copyright (c) 2026 Jev Visual contributors) | Pinned to commit `4382bba455647400951429134ceb012ca155e3fe`. The code is not modified; only the documented API (`jev_visual.Request`, `Engine.judge`) and the HTTP server are used |
| [OpenJev](https://github.com/TheoLeeCJ/openjev) | Original implementation that jev-visual is based on | MIT (Copyright 2026 TheoLeeCJ) | Credited as the source in jev-visual's `THIRD_PARTY.md` |
| [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) / [MLX 4-bit conversion](https://huggingface.co/mlx-community/Qwen3.5-4B-4bit) | Production screening model | Apache-2.0 (original model card) | Weights are downloaded at install time. Not included in the repository |
| [Qwen3.5-0.8B](https://huggingface.co/Qwen/Qwen3.5-0.8B) / MLX 4-bit conversion | Comparison model for evaluation | Apache-2.0 (original model card) | Same as above |
| npm dependencies (`package.json`) | UI and server | Each package's own license | `node_modules` is not included in the repository |

## Techniques referenced (no code copied)
- **Holo card effect** (`src/components/HoloCard.tsx`, `src/styles.css`): The approach follows [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) (GPL-3.0), well known for its Pokémon card holo effect.
  The pointer position is passed in as CSS variables (rotation `--rx/--ry`, foil position `--posx/--posy`, glare `--mx/--my`, intensity `--hyp`), and gradients and blend modes are layered on top.
  The code was written from scratch for this repository. Compared against that repository's full history (checked 2026-09-30), the only identical line of 30 or more characters is `background-blend-mode: exclusion, hue, hard-light`.

## About the name "Jev"
"Jev" is the name of a proprietary model by TypeSafe. The jev-visual used by this project is an **independent community implementation** that imitates its inference approach (scoring only the logits of candidate answers instead of generating an answer),
and jev-visual itself states that it does not reproduce the architecture or training of TypeSafe's Jev.
This repository is likewise not affiliated with TypeSafe.

## This repository's own assets
- Bukangi character art (`public/bukang-*.webp`): created by the author using an image-generation AI.
- Photos uploaded by citizens and the production DB are not included in the repository. In the result files under `eval/`, report IDs have been replaced with the anonymous numbers `s001`–`s147`.
