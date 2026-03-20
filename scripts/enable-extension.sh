#!/usr/bin/env bash
set -euo pipefail

UUID="keep-awake@gnome.org"
USER_EXT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"
SYSTEM_EXT_DIR="/usr/share/gnome-shell/extensions/$UUID"

if ! command -v gnome-extensions >/dev/null 2>&1; then
  echo "Error: gnome-extensions is required but was not found in PATH." >&2
  exit 1
fi

if [[ -d "$USER_EXT_DIR" ]]; then
  install_hint="$USER_EXT_DIR"
elif [[ -d "$SYSTEM_EXT_DIR" ]]; then
  install_hint="$SYSTEM_EXT_DIR"
else
  cat >&2 <<EOF
Error: Extension files are not installed.
Expected one of:
  - $USER_EXT_DIR
  - $SYSTEM_EXT_DIR

Run the build/install step first, then retry.
EOF
  exit 1
fi

if ! gnome-extensions info "$UUID" >/dev/null 2>&1; then
  cat >&2 <<EOF
Error: GNOME Shell has not discovered $UUID yet.
Detected installed files at: $install_hint

On Fedora 44 beta (GNOME 50 Wayland-only), log out and log back in,
then run this command again.
EOF
  exit 2
fi

if ! gnome-extensions enable "$UUID"; then
  echo "Error: Failed to enable $UUID." >&2
  exit 3
fi

echo "Enabled $UUID"
