# jimeng-skills

`jimeng-skills` is a publishable skills repository for Volcengine Jimeng generation workflows. The main skill lives at `skills/jimeng-skills/` and is designed for OpenClaw/Codex usage.

## Repository layout

```text
jimeng-skills/
├── README.md
├── RELEASE_NOTES.md
├── .gitignore
└── skills/
    └── jimeng-skills/
        ├── SKILL.md
        ├── skill.yaml
        ├── agents/openai.yaml
        ├── scripts/
        ├── .env.example
        ├── package.json
        └── tsconfig.json
```

## What it provides

- Text-to-image generation via Jimeng
- Text-to-video generation via Jimeng
- OpenClaw-friendly plain text output
- Remote direct links and optional public share URLs
- A GitHub-installable skill layout for external developers

## Local development

```bash
git clone <your-repo-url> jimeng-skills
cd jimeng-skills/skills/jimeng-skills
npm install
cp .env.example .env
```

Export credentials:

```bash
export VOLCENGINE_AK="your-access-key"
export VOLCENGINE_SK="your-secret-key"
export JIMENG_PUBLIC_BASE_URL="https://your-domain.example.com/jimeng-output"
```

Build:

```bash
npm run build
```

Run image generation:

```bash
npm run image -- "一只戴墨镜的柴犬，电影海报风格"
```

Run video generation:

```bash
npm run video -- "一只戴墨镜的柴犬在沙滩上奔跑" --wait
```

## Install as a skill

After publishing to GitHub:

```bash
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo <owner>/<repo> \
  --path skills/jimeng-skills
```

Fallback:

- Clone the repository
- Copy `skills/jimeng-skills/` into `~/.codex/skills/jimeng-skills/`
- Restart Codex

## Publishing

- Keep skill files under `skills/jimeng-skills/`
- Keep public repository documentation at the repository root
- Use `RELEASE_NOTES.md` for the first public release summary
