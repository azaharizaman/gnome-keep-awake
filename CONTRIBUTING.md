# Contributing to Gnome Keep Awake

First off, thanks for taking the time to contribute! Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please open an issue using the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md). Provide as much detail as possible, including:
- Steps to reproduce.
- Your GNOME version.
- Any relevant logs from `journalctl -f -t gnome-keep-awake-daemon`.

### Suggesting Enhancements
If you have an idea for a new feature, please open an issue using the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

### Code Contributions
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## Development Environment Setup
We use **Meson** and **Ninja** for the build system.
```bash
meson setup build
ninja -C build
```

## Code Style
- We follow standard GNOME JavaScript (GJS) conventions.
- Use ES Modules for the Shell Extension.
- Be concise and follow the existing architectural patterns.

## License
By contributing, you agree that your contributions will be licensed under its MIT License.
