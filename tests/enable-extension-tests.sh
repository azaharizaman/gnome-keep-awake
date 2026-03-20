#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/enable-extension.sh"
UUID="keep-awake@gnome.org"

pass_count=0
fail_count=0

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "ASSERT FAILED: expected output to contain: $needle"
    return 1
  fi
}

run_case() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS: $name"
    pass_count=$((pass_count + 1))
  else
    echo "FAIL: $name"
    fail_count=$((fail_count + 1))
  fi
}

with_temp_env() {
  local dir
  dir="$(mktemp -d)"
  trap "rm -rf '$dir'" RETURN

  export HOME="$dir/home"
  export XDG_DATA_HOME="$HOME/.local/share"
  mkdir -p "$XDG_DATA_HOME/gnome-shell/extensions"

  local bindir="$dir/bin"
  mkdir -p "$bindir"
  export PATH="$bindir:$PATH"

  "$@" "$dir"
}

case_missing_install() {
  with_temp_env _case_missing_install
}

_case_missing_install() {
  local dir="$1"
  cat >"$dir/bin/gnome-extensions" <<'EOF_MOCK'
#!/usr/bin/env bash
exit 0
EOF_MOCK
  chmod +x "$dir/bin/gnome-extensions"

  local out
  set +e
  out="$("$SCRIPT" 2>&1)"
  local status=$?
  set -e

  [[ $status -eq 1 ]] || { echo "expected status 1, got $status"; return 1; }
  assert_contains "$out" "Extension files are not installed" || return 1
}

case_not_discovered_yet() {
  with_temp_env _case_not_discovered_yet
}

_case_not_discovered_yet() {
  local dir="$1"
  local uuid_dir="$XDG_DATA_HOME/gnome-shell/extensions/$UUID"
  mkdir -p "$uuid_dir"

  cat >"$dir/bin/gnome-extensions" <<'EOF_MOCK'
#!/usr/bin/env bash
if [[ "$1" == "info" ]]; then
  exit 2
fi
if [[ "$1" == "enable" ]]; then
  echo "Extension not found" >&2
  exit 2
fi
exit 0
EOF_MOCK
  chmod +x "$dir/bin/gnome-extensions"

  local out
  set +e
  out="$("$SCRIPT" 2>&1)"
  local status=$?
  set -e

  [[ $status -eq 2 ]] || { echo "expected status 2, got $status"; return 1; }
  assert_contains "$out" "log out and log back in" || return 1
}

case_successful_enable() {
  with_temp_env _case_successful_enable
}

_case_successful_enable() {
  local dir="$1"
  local uuid_dir="$XDG_DATA_HOME/gnome-shell/extensions/$UUID"
  mkdir -p "$uuid_dir"

  cat >"$dir/bin/gnome-extensions" <<'EOF_MOCK'
#!/usr/bin/env bash
if [[ "$1" == "info" ]]; then
  exit 0
fi
if [[ "$1" == "enable" ]]; then
  exit 0
fi
exit 0
EOF_MOCK
  chmod +x "$dir/bin/gnome-extensions"

  local out
  out="$("$SCRIPT" 2>&1)"
  assert_contains "$out" "Enabled keep-awake@gnome.org" || return 1
}

run_case "missing install files" case_missing_install
run_case "shell has not discovered extension yet" case_not_discovered_yet
run_case "successful enable" case_successful_enable

echo "Passed: $pass_count, Failed: $fail_count"
[[ $fail_count -eq 0 ]]
