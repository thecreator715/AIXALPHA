#!/usr/bin/env bash
# Double-click on Mac: starts the AIX ALPHA master node (with a public tunnel if cloudflared is installed).
cd "$(dirname "$0")" || exit 1
./start-master.sh --public
