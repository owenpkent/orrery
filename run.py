#!/usr/bin/env python3
"""Orrery launcher.

    python run.py            # dev server, opens your browser
    python run.py dev        # same
    python run.py build      # type-check and build the static site into dist/
    python run.py preview    # build, then serve dist/ at the Pages subpath
    python run.py verify     # types, lint, tests
    python run.py doctor     # check prerequisites

Stdlib only; works with any Python 3.8+.
"""

from __future__ import annotations

import argparse
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

REPO = Path(__file__).resolve().parent
DEV_PORT = 5174  # pinned (strictPort) in vite.config.ts
DEV_URL = f"http://localhost:{DEV_PORT}/"
PREVIEW_PORT = 4173
PREVIEW_URL = f"http://localhost:{PREVIEW_PORT}/orrery/"


def need(name: str) -> str:
    path = shutil.which(name)
    if not path:
        sys.exit(f"error: '{name}' not found on PATH. Run `python run.py doctor`.")
    return path


def run(cmd: "list[str]") -> int:
    print(f"\n$ {' '.join(cmd)}\n")
    return subprocess.run(cmd, cwd=str(REPO)).returncode


def ensure_deps() -> None:
    if not (REPO / "node_modules").is_dir():
        print("node_modules missing; installing dependencies first...")
        if run([need("npm"), "install", "--no-audit", "--no-fund"]) != 0:
            sys.exit("npm install failed.")


def wait_for_port(port: int, timeout: float = 90.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.4)
    return False


def serve(cmd: "list[str]", port: int, url: str) -> int:
    ensure_deps()
    print(f"Starting {' '.join(cmd)}; opening {url} when ready. Ctrl+C stops.\n")

    def open_when_ready() -> None:
        if wait_for_port(port):
            webbrowser.open(url)
        else:
            print(f"\n(Server did not come up in time; open {url} manually.)")

    threading.Thread(target=open_when_ready, daemon=True).start()
    try:
        return subprocess.run(cmd, cwd=str(REPO)).returncode
    except KeyboardInterrupt:
        return 0


def cmd_dev(_args) -> int:
    return serve([need("npm"), "run", "dev"], DEV_PORT, DEV_URL)


def cmd_build(_args) -> int:
    ensure_deps()
    code = run([need("npm"), "run", "build"])
    if code == 0:
        print(f"\nStatic site written to {REPO / 'dist'}")
    return code


def cmd_preview(_args) -> int:
    if cmd_build(_args) != 0:
        return 1
    return serve([need("npm"), "run", "preview", "--", "--port", str(PREVIEW_PORT), "--strictPort"], PREVIEW_PORT, PREVIEW_URL)


def cmd_verify(_args) -> int:
    ensure_deps()
    return run([need("npm"), "run", "verify"])


def cmd_doctor(_args) -> int:
    print("Orrery prerequisites:\n")
    for name, why in [("node", "Node.js 20+"), ("npm", "installs and runs everything")]:
        path = shutil.which(name)
        print(f"  [{'OK ' if path else '-- '}] {name:5s} {why}")
        if path:
            print(f"         {path}")
    deps = (REPO / "node_modules").is_dir()
    print(f"\n  [{'OK ' if deps else '-- '}] node_modules  {'installed' if deps else 'MISSING (run: npm install)'}")
    return 0


COMMANDS = {
    "dev": cmd_dev,
    "build": cmd_build,
    "preview": cmd_preview,
    "verify": cmd_verify,
    "doctor": cmd_doctor,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Orrery launcher")
    parser.add_argument("command", nargs="?", default="dev", choices=sorted(COMMANDS))
    args = parser.parse_args()
    return COMMANDS[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
