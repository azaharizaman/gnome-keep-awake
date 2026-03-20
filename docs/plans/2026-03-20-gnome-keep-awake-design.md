# Design Document: Gnome Keep Awake

**Date:** 2026-03-20
**Status:** Validated
**Target Platform:** GNOME 50

## 1. Overview
Gnome Keep Awake is a modern utility designed to prevent GNOME from suspending or screen-blanking based on user-defined triggers and system states. It is a hybrid application consisting of a background daemon for reliability and a GNOME Shell extension for seamless UI integration.

## 2. Architecture
The application is split into two main components communicating over D-Bus:

### 2.1 Background Daemon (`gnome-keep-awake-daemon`)
- **Role:** Core logic engine and state manager.
- **Technology:** GJS (GNOME JavaScript) or Python with GObject.
- **Responsibilities:**
    - Manages `org.gnome.SessionManager` inhibits.
    - Monitors **UPower** for battery levels and AC status.
    - Monitors **MPRIS** (`org.mpris.MediaPlayer2`) for active media playback.
    - Monitors **D-Bus** for application-specific activity (IDEs, etc.).
    - Tracks **Power Profiles** via `net.hadess.PowerProfiles`.
- **D-Bus Interface:** `org.gnome.KeepAwake.Daemon`
    - Methods: `ToggleManualMode()`, `SetBatteryThreshold(int)`, `AddSmartTrigger(string)`.
    - Signals: `StateChanged(bool, string)`, `ThresholdReached()`.

### 2.2 GNOME Shell Extension
- **Role:** Primary User Interface.
- **Technology:** GNOME Shell Extension API (ES Modules, GNOME 50).
- **Responsibilities:**
    - Displays a System Indicator in the top panel.
    - Provides a quick-access menu for toggles and status.
    - Visual Warning States:
        - **Active:** Steady icon (e.g., sun).
        - **Inactive:** Dimmed/Alternate icon (e.g., moon).
        - **Power Saver Override:** High-contrast/Warning icon (e.g., sun with bolt).
    - Syncs UI state with the daemon via D-Bus.

## 3. Core Logic & Behaviors

### 3.1 Smart Triggers
- **Media Playback:** Automatically inhibits sleep if an MPRIS player is "Playing".
- **Application Activity:** Monitor specific D-Bus signals or process presence for IDEs and other critical tools.

### 3.2 Power Awareness
- **Power Saver Profile:** If the system enters "Power Saver" mode, the app continues to keep the system awake if a trigger is active but triggers a **Visual Warning** in the panel icon.
- **Battery Guardrail:** A user-defined threshold (e.g., 20%). If the battery drops below this limit while on battery power, all inhibits are released immediately.

### 3.3 Configuration
- **GSettings:** Used for persistent storage of battery thresholds, trigger lists, and override preferences. Schema: `org.gnome.KeepAwake`.

## 4. User Experience (UX)
- **Non-Intrusive:** Works in the background until needed.
- **Informative:** The extension menu shows *why* the system is staying awake (e.g., "Active: VLC Media Player").
- **Safe:** Automatically yields to system safety (battery threshold) to prevent unexpected shutdowns.

## 5. Future Considerations
- Libadwaita Preferences App for advanced configuration.
- Support for custom shell scripts as triggers.
