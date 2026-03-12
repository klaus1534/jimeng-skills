# Release Notes

## v0.2.0

Initial public release of `jimeng-skills`.

### Highlights

- Added a reusable Jimeng skill for OpenClaw/Codex workflows
- Supports text-to-image generation
- Supports text-to-video generation
- Returns OpenClaw-friendly plain text output for Feishu, WeCom, and DingTalk
- Returns local file paths, remote direct links, and optional public share URLs
- Added standardized skill metadata for Codex/OpenAI skill discovery
- Reorganized the repository into a publishable `skills/jimeng-skills/` layout

### Requirements

- Node.js 20+
- Jimeng API access on Volcengine
- `VOLCENGINE_AK`
- `VOLCENGINE_SK` or `VOLCENGINE_TOKEN`

### Installation

Install from a GitHub repo path after publishing:

```bash
python ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo <owner>/<repo> \
  --path skills/jimeng-skills
```

### Notes

- For enterprise IM cross-device viewing, configure `JIMENG_PUBLIC_BASE_URL` or rely on Jimeng remote URLs
- Local files under `output/` are for debugging and local reuse
