# In-Panel Settings Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expandable in-panel settings menu with battery threshold slider and smart triggers submenu to the GNOME Keep Awake extension.

**Architecture:** Modify existing extension.js to add two new menu rows: battery threshold with slider popup, and smart triggers with submenu. Uses GNOME Shell PopupMenu and St APIs.

**Tech Stack:** GJS, GNOME Shell UI (PopupMenu, St), GSettings

---

### Task 1: Add battery threshold row with slider popup

**Files:**
- Modify: `extension/extension.js` (after toggle menu item around line 64)

- [ ] **Step 1: Write test helper to verify menu structure**

Manual test: Open extension menu in GNOME Shell, verify:
1. "Auto-pause below: 20%" row appears after toggle
2. Tapping row opens slider popup
3. Slider changes update the label and GSettings

- [ ] **Step 2: Add threshold row implementation**

After toggle menu item (around line 64), add:

```javascript
this._thresholdItem = new PopupMenu.PopupMenuItem(
    `Auto-pause below: ${this._settings.get_int('battery-threshold')}%`
);
this._thresholdItem.connect('activate', () => {
    this._showThresholdPopup(this._thresholdItem);
});
this.menu.addMenuItem(this._thresholdItem);
```

Add helper method after `_updateIcon()`:

```javascript
_showThresholdPopup(anchor) {
    const threshold = this._settings.get_int('battery-threshold');
    
    const container = new St.BoxLayout({
        vertical: true,
        style_class: 'popup-menu-content',
        x_align: Clutter.ActorAlign.CENTER,
    });
    
    const label = new St.Label({ text: `${threshold}%` });
    const slider = new St.Slider({ value: threshold / 100 });
    
    slider.connect('value-changed', (s, value) => {
        const valueInt = Math.round(value * 100);
        label.text = `${valueInt}%`;
        this._settings.set_int('battery-threshold', valueInt);
    });
    
    container.add_child(label);
    container.add_child(slider);
    
    const popupMenu = new PopupMenu.PopupMenu(anchor, 0.5, St.Side.TOP);
    popupMenu.box.add_child(container);
    popupMenu.connect('key-press-event', (menu, event) => {
        if (event.get_key_symbol() === Clutter.Escape) {
            popupMenu.close();
            return true;
        }
        return false;
    });
    
    const closeOnOutsideClick = (actor, event) => {
        if (!popupMenu.actor.contains(event.get_actor())) {
            popupMenu.close();
        }
    };
    
    const connectionId = global.stage.connect('button-press-event', closeOnOutsideClick);
    popupMenu.connect('closed', () => {
        global.stage.disconnect(connectionId);
    });
    
    this.menu.addMenuItem(popupMenu);
    popupMenu.open(true);
}
```

- [ ] **Step 3: Add Clutter import**

Check existing imports in extension.js. Add if not present:
```javascript
import Clutter from 'gi://Clutter';
```

- [ ] **Step 4: Test and verify**

Run: `./scripts/enable-extension.sh && meson compile -C build enable-extension`
Restart GNOME Shell, open menu, verify threshold row appears and slider works.

- [ ] **Step 5: Commit**

```bash
git add extension/extension.js
git commit -m "feat: add battery threshold row with slider popup"
```

---

### Task 2: Add smart triggers row with submenu

**Files:**
- Modify: `extension/extension.js` (after threshold item, before status label)

- [ ] **Step 1: Write test helper to verify menu structure**

Manual test: Open extension menu in GNOME Shell, verify:
1. "Smart triggers: N apps" row appears after threshold
2. Tapping row opens submenu with app list
3. Can add new app ID
4. Can remove existing app ID

- [ ] **Step 2: Add triggers submenu implementation**

After threshold item (before status label), add:

```javascript
this._triggersSubMenu = new PopupMenu.PopupSubMenuMenuItem(
    `Smart triggers: ${this._settings.get_strv('smart-triggers').length} apps`
);
this._updateTriggersSubMenu();
this.menu.addMenuItem(this._triggersSubMenu);
```

Add helper methods:

```javascript
_updateTriggersSubMenu() {
    const triggers = this._settings.get_strv('smart-triggers');
    this._triggersSubMenu.label.text = `Smart triggers: ${triggers.length} apps`;
    
    this._triggersSubMenu.menu.removeAll();
    
    const header = new PopupMenu.PopupMenuItem('Smart Triggers', {
        reactive: false,
        activate: false,
    });
    header.label.style = 'font-weight: bold; color: #888;';
    this._triggersSubMenu.menu.addMenuItem(header);
    
    triggers.forEach((appId, index) => {
        const item = new PopupMenu.PopupMenuItem(appId);
        
        const removeBtn = new St.Button({
            label: '×',
            style_class: 'system-button',
        });
        removeBtn.connect('clicked', () => {
            this._removeTrigger(index);
        });
        
        item.actor.add_child(removeBtn);
        removeBtn.x_align = Clutter.ActorAlign.END;
        
        this._triggersSubMenu.menu.addMenuItem(item);
    });
    
    const addItem = new PopupMenu.PopupMenuItem('Add application...');
    addItem.connect('activate', () => {
        this._showAddTriggerDialog();
    });
    this._triggersSubMenu.menu.addMenuItem(addItem);
}

_removeTrigger(index) {
    const triggers = this._settings.get_strv('smart-triggers');
    triggers.splice(index, 1);
    this._settings.set_strv('smart-triggers', triggers);
    this._updateTriggersSubMenu();
}

_showAddTriggerDialog() {
    const entry = new St.Entry({
        hint_text: 'e.g., org.mozilla.firefox',
        style_class: 'system-dialog-entry',
    });
    
    const container = new St.BoxLayout({
        vertical: false,
        style_class: 'popup-menu-content',
    });
    
    container.add_child(entry);
    
    const addButton = new St.Button({ label: 'Add' });
    addButton.connect('clicked', () => {
        const appId = entry.get_text().trim();
        if (appId) {
            const triggers = this._settings.get_strv('smart-triggers');
            triggers.push(appId);
            this._settings.set_strv('smart-triggers', triggers);
            this._updateTriggersSubMenu();
        }
    });
    container.add_child(addButton);
    
    const popupMenu = new PopupMenu.PopupMenu(this._triggersSubMenu, 0.5, St.Side.TOP);
    popupMenu.box.add_child(container);
    this.menu.addMenuItem(popupMenu);
    popupMenu.open(true);
}
```

- [ ] **Step 3: Test and verify**

Restart GNOME Shell, open menu, verify triggers submenu works.

- [ ] **Step 4: Commit**

```bash
git add extension/extension.js
git commit -m "feat: add smart triggers submenu"
```

---

### Task 3: Add settings change listeners

**Files:**
- Modify: `extension/extension.js` (after existing settings.connect for 'enabled')

- [ ] **Step 1: Add listeners for settings changes**

Add after settings connection for enabled:

```javascript
this._settings.connect('changed::battery-threshold', () => {
    const threshold = this._settings.get_int('battery-threshold');
    this._thresholdItem.label.text = `Auto-pause below: ${threshold}%`;
});

this._settings.connect('changed::smart-triggers', () => {
    this._updateTriggersSubMenu();
});
```

- [ ] **Step 2: Commit**

```bash
git add extension/extension.js
git commit -m "feat: add settings change listeners for UI updates"
```

---

### Task 4: Final integration and cleanup

**Files:**
- Modify: `extension/extension.js`

- [ ] **Step 1: Rebuild and test full menu**

Run: `meson compile -C build && meson install -C build`
Restart GNOME Shell, verify:
1. Toggle works
2. Threshold slider works
3. Triggers submenu works
4. All settings persist

- [ ] **Step 2: Fix any issues and final commit**

```bash
git add extension/extension.js
git commit -m "feat: complete in-panel settings menu"
```
