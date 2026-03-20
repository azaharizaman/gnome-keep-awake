# Gnome Keep Awake Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready GNOME 50 keep-awake utility with a background daemon and shell extension.

**Architecture:** A lightweight GJS daemon manages system inhibits via D-Bus, monitoring UPower, MPRIS, and Power Profiles. A GNOME 50 Shell Extension provides a dynamic system indicator for control and visual status feedback.

**Tech Stack:** GJS (GNOME JavaScript), Meson Build System, GSettings, D-Bus, UPower, MPRIS.

---

### Task 1: Project Structure & Build System

**Files:**
- Create: `meson.build`
- Create: `src/meson.build`
- Create: `extension/meson.build`
- Create: `data/meson.build`

**Step 1: Create top-level `meson.build`**

```meson
project('gnome-keep-awake', 'c',
  version: '1.0.0',
  meson_version: '>= 0.62.0',
)

i18n = import('i18n')
gnome = import('gnome')

subdir('data')
subdir('src')
subdir('extension')
```

**Step 2: Create `data/meson.build` for GSettings**

```meson
install_data('org.gnome.KeepAwake.gschema.xml',
  install_dir: get_option('datadir') / 'glib-2.0/schemas'
)

gnome.compile_schemas(
  build_by_default: true,
  depend_files: 'org.gnome.KeepAwake.gschema.xml'
)
```

**Step 3: Create `data/org.gnome.KeepAwake.gschema.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist gettext-domain="gnome-keep-awake">
  <schema id="org.gnome.KeepAwake" path="/org/gnome/KeepAwake/">
    <key name="enabled" type="b">
      <default>false</default>
      <summary>Enable keep-awake</summary>
    </key>
    <key name="battery-threshold" type="i">
      <default>20</default>
      <summary>Battery percentage threshold to auto-disable</summary>
    </key>
    <key name="smart-triggers" type="as">
      <default>[]</default>
      <summary>List of application IDs to trigger keep-awake</summary>
    </key>
  </schema>
</schemalist>
```

**Step 4: Commit**

```bash
git add meson.build data/ src/ extension/
git commit -m "chore: initialize project structure and build system"
```

---

### Task 2: Background Daemon - D-Bus Service

**Files:**
- Create: `src/daemon.js`
- Create: `src/org.gnome.KeepAwake.Daemon.service.in`

**Step 1: Implement basic D-Bus Skeleton in `src/daemon.js`**

```javascript
#!/usr/bin/env gjs

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const DaemonInterface = `
<node>
  <interface name="org.gnome.KeepAwake.Daemon">
    <method name="ToggleManualMode">
      <arg type="b" name="enabled" direction="in"/>
    </method>
    <signal name="StateChanged">
      <arg type="b" name="active"/>
      <arg type="s" name="reason"/>
    </signal>
  </interface>
</node>`;

class KeepAwakeDaemon {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJS(DaemonInterface, this);
        this._enabled = false;
    }

    ToggleManualMode(enabled) {
        this._enabled = enabled;
        this._dbusImpl.emit_signal('StateChanged', this._enabled, 'Manual');
    }

    run() {
        Gio.bus_own_name(Gio.BusType.SESSION, 'org.gnome.KeepAwake.Daemon',
            Gio.BusNameOwnerFlags.NONE,
            (conn) => this._dbusImpl.export(conn, '/org/gnome/KeepAwake/Daemon'),
            null, null);

        const loop = new GLib.MainLoop(null, false);
        loop.run();
    }
}

const daemon = new KeepAwakeDaemon();
daemon.run();
```

**Step 2: Create D-Bus service file template**

```ini
[D-BUS Service]
Name=org.gnome.KeepAwake.Daemon
Exec=@bindir@/gnome-keep-awake-daemon
```

**Step 3: Commit**

```bash
git add src/daemon.js src/org.gnome.KeepAwake.Daemon.service.in
git commit -m "feat: implement background daemon skeleton"
```

---

### Task 3: Core Logic - Inhibits & UPower

**Files:**
- Modify: `src/daemon.js`

**Step 1: Add Session Manager Inhibit Logic**

```javascript
// Inside KeepAwakeDaemon class
_updateInhibit() {
    if (this._enabled && !this._inhibitCookie) {
        // Call org.gnome.SessionManager.Inhibit
        // ...
    } else if (!this._enabled && this._inhibitCookie) {
        // Call org.gnome.SessionManager.Uninhibit
        // ...
    }
}
```

**Step 2: Add UPower monitoring**

```javascript
// Monitor UPower for battery levels and AC status
```

**Step 3: Commit**

```bash
git add src/daemon.js
git commit -m "feat: add inhibit and UPower logic to daemon"
```

---

### Task 4: GNOME 50 Shell Extension

**Files:**
- Create: `extension/extension.js`
- Create: `extension/metadata.json`

**Step 1: Implement GNOME 50 ESM Extension Indicator**

```javascript
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export default class KeepAwakeExtension extends Extension {
    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Keep Awake');
        Main.panel.addToStatusArea('keep-awake', this._indicator);
    }
    disable() {
        this._indicator.destroy();
    }
}
```

**Step 2: Commit**

```bash
git add extension/
git commit -m "feat: initial GNOME 50 extension indicator"
```

---

### Task 5: Final Integration & Verification

**Steps:**
1. Run `meson build && ninja -C build install`
2. Restart GNOME Shell (`Alt+F2` then `r` or logout/login)
3. Test manual toggle via Extension menu.
4. Verify battery threshold behavior by simulating low battery.
