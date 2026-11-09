# AIX Alpha Node (Mac Studio)

1. Install Ollama (ollama.com) and pull a model, e.g. `ollama pull qwen3.8:27b`.
2. Run Ollama (it starts automatically on macOS) and then in this folder:
   `AIX_TOKEN=$(openssl rand -hex 24) node server.js` (copy the token it uses; set it yourself to keep it).
3. In AIX Alpha: Settings > Local node. URL `http://localhost:8787` (same Mac) and the token + model name. Tick "Use my node as the engine".
4. For other devices or the claude.ai artifact you need an https URL: `tailscale serve --bg 8787` (or `tailscale funnel 8787`), then paste that https URL.

## Hosted images and site files
Users' images and site files are stored in `hosted/<id>/` next to `server.js` (one folder per account, created automatically). The cloud enforces each account's quota; this folder is the actual storage, so keep the Mac awake and the node running. Back up the `hosted/` folder if you care about it. The Storage tab in the control panel shows usage per account.
