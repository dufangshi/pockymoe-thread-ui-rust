#!/bin/sh
# Install or update agent-launch without cloning the repository or installing pnpm.
set -eu

main() {
  for program in node npm curl tar; do
    if ! command -v "$program" >/dev/null 2>&1; then
      echo "agent-launch requires $program. Install Node.js 20+ (including npm), curl, and tar first." >&2
      exit 1
    fi
  done
  if ! node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)'; then
    echo "agent-launch requires Node.js 20 or later." >&2
    exit 1
  fi

  source_url="${AGENT_LAUNCH_SOURCE_URL:-https://codeload.github.com/dufangshi/pockymoe-thread-ui-rust/tar.gz/refs/heads/main}"
  install_tmp="$(mktemp -d "${TMPDIR:-/tmp}/agent-launch-install.XXXXXX")"
  trap 'rm -rf "$install_tmp"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  echo "Downloading agent-launch..."
  curl --fail --silent --show-error --location "$source_url" --output "$install_tmp/source.tgz"
  mkdir "$install_tmp/source"
  tar -xzf "$install_tmp/source.tgz" -C "$install_tmp/source" --strip-components=1
  server="$install_tmp/source/apps/agent-ui-server"
  if [ ! -f "$server/package-lock.json" ] || [ ! -f "$install_tmp/source/apps/agent-ui-web/dist/index.html" ]; then
    echo "Download does not contain the agent-launch source and bundled UI." >&2
    exit 1
  fi

  echo "Building agent-launch..."
  npm --prefix "$server" ci --include=dev --ignore-scripts --no-audit --no-fund
  npm --prefix "$server" run build
  version="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version' "$server/package.json")"
  npm pack "$server" --ignore-scripts --pack-destination "$install_tmp" --silent

  echo "Installing agent-launch ${version}..."
  npm install --global "$install_tmp/agent-launch-$version.tgz" --no-audit --no-fund
  echo "Installed agent-launch $version. Run: agent-launch codex"
  echo "Run this same installer again to update. Your saved sessions are preserved."
}

main "$@"
