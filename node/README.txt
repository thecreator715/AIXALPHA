AIX NODE FOR MAC
================
1. Unzip this folder anywhere (Desktop is fine).
2. Double-click  "Start AIX Node.command".
   If macOS says it cannot be opened: right-click it > Open > Open
   (or in Terminal:  xattr -dr com.apple.quarantine "AIX Node")
3. It installs the latest Ollama, downloads a coding model sized for your Mac's memory,
   starts the node and opens AIX Alpha. Click "Connect" in the page.
4. Keep the Terminal window open while you use the app.

Use Chrome or Firefox for the app on the same Mac (Safari may block http://localhost from an https page).
For your phone or the claude.ai artifact, install Tailscale on the Mac first: the launcher then
uses an https address automatically.

Change the model:   MODEL=llama3.3:70b "./Start AIX Node.command"   (any name from ollama.com/library)
Your token lives in .aix-token. Delete that file to make a new one.

DASHBOARD
Open http://localhost:8787/ while the node is running: live CPU/memory, loaded models, request log, download/delete models, test chat. Enter the token from .aix-token.
UPDATING: drop a newer server.js and monitor.html into this folder (keep .aix-token) and run the launcher again.
