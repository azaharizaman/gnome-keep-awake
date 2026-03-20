# Gnome Keep Awake

A modern GNOME 50 utility designed to keep your system awake based on smart triggers and battery awareness. Inspired by the legacy "Awake" extension, this is a complete rewrite for the modern GNOME ecosystem.

## Features

- **Smart Triggers:** Automatically keeps the system awake during media playback (MPRIS) or when specific applications are active.
- **Battery Awareness:** Automatically releases keep-awake locks when the battery drops below a user-defined threshold (default: 20%).
- **Power Profile Integration:** Visual warnings in the panel when keeping the system awake overrides a "Power Saver" profile.
- **Hybrid Architecture:** A robust background daemon for reliability and a lightweight GNOME Shell extension for seamless UI control.

## Installation

### Dependencies
- Fedora 44 beta (or another GNOME 50 distro)
- GNOME 50
- GJS (GNOME JavaScript)
- Meson & Ninja (for building)

### Build & Install
```bash
# System-wide installation (requires sudo)
meson setup --prefix=/usr build-system
meson compile -C build-system
sudo meson install -C build-system

# Local development installation
meson setup --prefix=$HOME/.local build-user
meson compile -C build-user
meson install -C build-user
```

### Enable Extension
```bash
./scripts/enable-extension.sh
# or via Meson target
meson compile -C build-user enable-extension
```

If `./scripts/enable-extension.sh` says GNOME Shell has not discovered the extension yet:
- On Fedora 44 beta / GNOME 50 (Wayland-only), log out and log back in.
- Then run `./scripts/enable-extension.sh` again.

## Configuration

Settings can be managed via the GNOME Shell Extension's indicator menu or using `gsettings`:

- **Enabled:** `gsettings set org.gnome.KeepAwake enabled true`
- **Battery Threshold:** `gsettings set org.gnome.KeepAwake battery-threshold 15`
- **Smart Triggers:** `gsettings set org.gnome.KeepAwake smart-triggers "['code', 'vlc']"`

## Architecture

1. **Background Daemon (`gnome-keep-awake-daemon`):**
   Handles the core logic, monitors UPower, MPRIS, and Power Profiles. It manages system inhibits via `org.gnome.SessionManager`.
2. **GNOME Shell Extension:**
   Provides the top-bar indicator, status feedback (e.g., "Active: Media Playback"), and a quick-access toggle menu.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) to get started.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---
Built with ❤️ for the GNOME community.
