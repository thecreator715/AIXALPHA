# AIX Alpha Node (Mac Studio)

1. Install Ollama (ollama.com) and pull a model, e.g. `ollama pull qwen3.8:27b`.
2. Run Ollama (it starts automatically on macOS) and then in this folder:
   `AIX_TOKEN=$(openssl rand -hex 24) node server.js` (copy the token it uses; set it yourself to keep it).
3. In AIX Alpha: Settings > Local node. URL `http://localhost:8787` (same Mac) and the token + model name. Tick "Use my node as the engine".
4. For other devices or the claude.ai artifact you need an https URL: `tailscale serve --bg 8787` (or `tailscale funnel 8787`), then paste that https URL.

## Hosted images and site files
Users' images and site files are stored in `hosted/<id>/` next to `server.js` (one folder per account, created automatically). The cloud enforces each account's quota; this folder is the actual storage, so keep the Mac awake and the node running. Back up the `hosted/` folder if you care about it. The Storage tab in the control panel shows usage per account.

## Commands
- **AIX MASTER.command**: one double-click. Stops old processes, checks cloud link, secret, files and disk space, then starts everything.
- **Install Qwen Image.command**: installs Qwen-Image 2.1 (mflux), tests it and switches the node to it. Runs automatically on first start; needs about 45 GB free.
- **Install Local Video.command**: installs local video (LTX-2.5, MLX; falls back to LTX-2.3), tests it and switches the node to it. Runs automatically on first start after the image install; needs about 70 GB free. Log: runtime/video-install.log.
- **Update Qwen.command**: re-downloads every launcher (syntax-checked, with a backup) and the node, rebuilds the model list, starts everything. Run this once after receiving a new zip.
- **Start AIX Node.command**: installs/updates Ollama, downloads models, keeps the Mac awake, proves the model loads (steps the context down if memory is short), runs the node and tunnel. ALPHA XQ switches to Qwen 4 automatically once Ollama has it.
- **Install AutoStart.command**: start at every login.
- **Open Node Panel.command**: open the control panel.
