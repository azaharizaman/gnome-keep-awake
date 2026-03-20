import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

const DaemonIface = `
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

const DaemonProxy = Gio.DBusProxy.makeProxyWrapper(DaemonIface);

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, extension.metadata.name, false);
        this._settings = extension.getSettings();
        this._active = false;
        this._reason = 'Unknown';
        
        this._icon = new St.Icon({
            icon_name: 'night-light-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._proxy = new DaemonProxy(
            Gio.DBus.session,
            'org.gnome.KeepAwake.Daemon',
            '/org/gnome/KeepAwake/Daemon',
            (proxy, error) => {
                if (error) {
                    console.warn(`Keep Awake: Failed to connect to daemon: ${error.message}`);
                    this._updateState(false, 'Daemon Offline');
                } else {
                    proxy.connectSignal('StateChanged', (p, sender, [active, reason]) => {
                        this._updateState(active, reason);
                    });
                    // If the daemon is already running, we'll get the state from settings initially
                    // and then from signals as they happen.
                }
            }
        );

        this._menuItem = new PopupMenu.PopupSwitchMenuItem('Keep Awake', this._settings.get_boolean('enabled'));
        this._menuItem.connect('toggled', (item, state) => {
            this._settings.set_boolean('enabled', state);
            if (this._proxy.g_name_owner) {
                this._proxy.ToggleManualModeRemote(state);
            }
        });
        this.menu.addMenuItem(this._menuItem);

        this._thresholdItem = new PopupMenu.PopupMenuItem(
            `Auto-pause below: ${this._settings.get_int('battery-threshold')}%`
        );
        this._thresholdItem.connect('activate', () => {
            this._showThresholdPopup(this._thresholdItem);
        });
        this.menu.addMenuItem(this._thresholdItem);

        this._triggersSubMenu = new PopupMenu.PopupSubMenuMenuItem(
            `Smart triggers: ${this._settings.get_strv('smart-triggers').length} apps`
        );
        this._updateTriggersSubMenu();
        this.menu.addMenuItem(this._triggersSubMenu);

        this._statusLabel = new PopupMenu.PopupMenuItem('Status: Inactive', {
            reactive: false,
            activate: false,
            hover: false,
            can_focus: false,
        });
        this.menu.addMenuItem(this._statusLabel);

        this._settings.connect('changed::enabled', () => {
            const enabled = this._settings.get_boolean('enabled');
            if (this._menuItem.state !== enabled) {
                this._menuItem.setToggleState(enabled);
            }
            this._updateIcon();
        });

        this._settings.connect('changed::battery-threshold', () => {
            const threshold = this._settings.get_int('battery-threshold');
            this._thresholdItem.label.text = `Auto-pause below: ${threshold}%`;
        });

        this._settings.connect('changed::smart-triggers', () => {
            this._updateTriggersSubMenu();
        });

        this._updateState(false, 'Initializing...');
    }

    _updateState(active, reason) {
        this._active = active;
        this._reason = reason;
        this._updateIcon();
    }

    _updateIcon() {
        const enabled = this._settings.get_boolean('enabled');
        let iconName = 'night-light-symbolic';
        let statusText = 'Status: Inactive';

        if (this._active) {
            iconName = 'sunny-symbolic';
            statusText = `Status: Active (${this._reason})`;
        } else if (enabled) {
            // It should be active but isn't - could be battery or other reasons
            iconName = 'power-profile-power-saver-symbolic';
            statusText = `Status: Paused (${this._reason || 'check logs'})`;
        } else if (this._reason === 'Media Playback') {
             // Daemon might signal media playback even if manual is off
             iconName = 'sunny-symbolic';
             statusText = 'Status: Active (Media Playback)';
        }

        this._icon.icon_name = iconName;
        this._statusLabel.label.text = statusText;
    }

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
            popupMenu.destroy();
        });

        popupMenu.open(true);
    }

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
        const closePopup = () => {
            popupMenu.close();
        };
        addButton.connect('clicked', () => {
            const appId = entry.get_text().trim();
            if (appId) {
                const triggers = this._settings.get_strv('smart-triggers');
                triggers.push(appId);
                this._settings.set_strv('smart-triggers', triggers);
            }
            closePopup();
        });
        container.add_child(addButton);

        const popupMenu = new PopupMenu.PopupMenu(this._triggersSubMenu, 0.5, St.Side.TOP);
        popupMenu.box.add_child(container);
        popupMenu.connect('key-press-event', (menu, event) => {
            if (event.get_key_symbol() === Clutter.Escape) {
                closePopup();
                return true;
            }
            if (event.get_key_symbol() === Clutter.Return) {
                addButton.emit('clicked');
                return true;
            }
            return false;
        });

        const closeOnOutsideClick = (actor, event) => {
            if (!popupMenu.actor.contains(event.get_actor())) {
                closePopup();
            }
        };

        const connectionId = global.stage.connect('button-press-event', closeOnOutsideClick);
        popupMenu.connect('closed', () => {
            global.stage.disconnect(connectionId);
            popupMenu.destroy();
        });

        popupMenu.open(true);
    }

    destroy() {
        if (this._settings) {
            this._settings.run_dispose();
            this._settings = null;
        }
        super.destroy();
    }
});

export default class KeepAwakeExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
