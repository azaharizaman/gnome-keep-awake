# In-Panel Settings Menu Design

## Overview

Add an expandable in-panel settings menu to the GNOME Keep Awake extension that allows users to configure all settings directly from the panel indicator without opening a separate preferences window.

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| enabled | boolean | false | Manual on/off toggle |
| battery-threshold | int | 20 | Battery percentage to auto-disable |
| smart-triggers | array of strings | [] | App IDs that trigger keep-awake |

## Menu Structure

```
[Icon] ▼
├── [Toggle] Keep Awake
├── ───────────────────
├── Auto-pause below: 20%
├── Smart triggers: 3 apps
└── Status: Active (Media Playback)
```

## UI Components

### 1. Keep Awake Toggle (existing)
- Type: PopupSwitchMenuItem
- Label: "Keep Awake"
- State synced with `enabled` setting

### 2. Battery Threshold Row
- Type: PopupMenuItem with custom render
- Label: "Auto-pause below: {value}%"
- Action: Opens slider popup on tap
- Slider popup:
  - Horizontal slider (0-100%)
  - Live value display
  - Updates `battery-threshold` setting on change
  - Dismiss on click outside

### 3. Smart Triggers Row
- Type: PopupMenuItem with custom render
- Label: "Smart triggers: {count} apps"
- Action: Opens submenu on tap
- Submenu contents:
  - Header: "Smart Triggers"
  - List of app IDs with remove button (×) each
  - "Add application..." row → opens text input dialog
  - Input dialog: TextField to enter app ID (e.g., `org.mozilla.firefox`)
  - Add button to confirm

## Implementation Details

### Files Modified
- `extension/extension.js` - Main extension with indicator and menu

### GNOME Shell APIs Used
- `PopupMenu.PopupMenuItem` - Base menu item
- `PopupMenu.PopupSubMenu` - For triggers submenu
- `St.Slider` - For battery threshold slider
- `St.Entry` - For app ID text input

### Data Flow
1. Menu reads current values from GSettings on open
2. Toggle: directly sets `enabled` boolean
3. Threshold slider: debounced update to `battery-threshold` int
4. Triggers: direct update to `smart-triggers` array of strings

### Error Handling
- If daemon is offline, show "Daemon Offline" status
- Invalid app IDs: accept any string (daemon validates)
- Settings changes propagate to daemon via existing D-Bus

## Acceptance Criteria

1. Toggle switch enables/disables keep-awake
2. Threshold row shows current percentage, slider updates setting
3. Triggers row shows count, submenu lists all app IDs
4. Can add new app ID via text input
5. Can remove existing app ID
6. All changes persist across GNOME Shell restarts
7. UI follows GNOME HIG styling
