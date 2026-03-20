import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

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
            // It should be active but isn't. Likely battery warning.
            iconName = 'power-profile-power-saver-symbolic';
            statusText = 'Status: Warning (Battery Low)';
        } else if (this._reason === 'Media Playback') {
             // Daemon might signal media playback even if manual is off
             iconName = 'sunny-symbolic';
             statusText = 'Status: Active (Media Playback)';
        }

        this._icon.icon_name = iconName;
        this._statusLabel.label.text = statusText;
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
