#!/usr/bin/env bash
# Double-click on Mac: closes old connections, verifies your key, starts the master node and opens the app.
cd "$(dirname "$0")" || exit 1
./start-master.sh --public
