# Gnome Keep Awake

A modern GNOME 50 utility designed to keep your system awake based on smart triggers and battery awareness. Inspired by the legacy "Awake" extension, this is a complete rewrite for the modern GNOME ecosystem.

## Features

- **Smart Triggers:** Automatically keeps the system awake during media playback (MPRIS) or when specific applications are active.
- **Battery Awareness:** Automatically releases keep-awake locks when the battery drops below a user-defined threshold (default: 20%).
- **Power Profile Integration:** Visual warnings in the panel when keeping the system awake overrides a "Power Saver" profile.
- **Hybrid Architecture:** A robust background daemon for reliability and a lightweight GNOME Shell extension for seamless UI control.

## Installation

### Dependencies
- GNOME 50
- GJS (GNOME JavaScript)
- Meson & Ninja (for building)

### Build & Install
```bash
meson setup build
ninja -C build
# Install system-wide (requires sudo)
sudo ninja -C build install
# Or for local development
ninja -C build install --destdir=~/.local
```

### Enable Extension
```bash
gnome-extensions enable keep-awake@gnome.org
```

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
