#!/usr/bin/env gjs

const { Gio, GLib, GObject } = imports.gi;

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

const SessionManagerIface = `
<node>
  <interface name="org.gnome.SessionManager">
    <method name="Inhibit">
      <arg type="s" name="app_id" direction="in"/>
      <arg type="u" name="toplevel_xid" direction="in"/>
      <arg type="s" name="reason" direction="in"/>
      <arg type="u" name="flags" direction="in"/>
      <arg type="u" name="inhibit_cookie" direction="out"/>
    </method>
    <method name="Uninhibit">
      <arg type="u" name="inhibit_cookie" direction="in"/>
    </method>
  </interface>
</node>`;

const UPowerIface = `
<node>
  <interface name="org.freedesktop.UPower">
    <property name="OnBattery" type="b" access="read"/>
  </interface>
</node>`;

const UPowerDeviceIface = `
<node>
  <interface name="org.freedesktop.UPower.Device">
    <property name="Percentage" type="d" access="read"/>
  </interface>
</node>`;

const MprisPlayerIface = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <property name="PlaybackStatus" type="s" access="read"/>
  </interface>
</node>`;

const SessionManagerProxy = Gio.DBusProxy.makeProxyWrapper(SessionManagerIface);
const UPowerProxy = Gio.DBusProxy.makeProxyWrapper(UPowerIface);
const UPowerDeviceProxy = Gio.DBusProxy.makeProxyWrapper(UPowerDeviceIface);
const MprisPlayerProxy = Gio.DBusProxy.makeProxyWrapper(MprisPlayerIface);

var KeepAwakeDaemon = GObject.registerClass({
    GTypeName: 'KeepAwakeDaemon',
}, class KeepAwakeDaemon extends GObject.Object {
    _init() {
        super._init();

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DaemonInterface, this);
        
        try {
            this._settings = new Gio.Settings({ schema_id: 'org.gnome.KeepAwake' });
            this._settings.connect('changed::enabled', () => this._updateInhibit());
            this._settings.connect('changed::battery-threshold', () => this._updateInhibit());
        } catch (e) {
            console.error('Failed to load GSettings. Make sure schema is installed or GSETTINGS_SCHEMA_DIR is set.');
            // Fallback for development if needed, but we should rely on settings
        }

        this._inhibitCookie = 0;
        this._onBattery = false;
        this._batteryPercentage = 100;
        this._anyMediaPlaying = false;
        this._mprisPlayers = new Map();

        this._initSessionManager();
        this._initUPower();
        this._watchMpris();
    }

    _initSessionManager() {
        this._sessionProxy = new SessionManagerProxy(
            Gio.DBus.session,
            'org.gnome.SessionManager',
            '/org/gnome/SessionManager',
            (proxy, error) => {
                if (error) {
                    console.error('Failed to connect to SessionManager:', error.message);
                } else {
                    this._updateInhibit();
                }
            }
        );
    }

    _initUPower() {
        this._upowerProxy = new UPowerProxy(
            Gio.DBus.system,
            'org.freedesktop.UPower',
            '/org/freedesktop/UPower',
            (proxy, error) => {
                if (error) {
                    console.warn('Failed to connect to UPower:', error.message);
                    return;
                }
                this._onBattery = proxy.OnBattery;
                proxy.connect('g-properties-changed', (p, changed) => {
                    const properties = changed.unpack();
                    if ('OnBattery' in properties) {
                        this._onBattery = properties.OnBattery.unpack();
                        this._updateInhibit();
                    }
                });
                this._updateInhibit();
            }
        );

        this._upowerDeviceProxy = new UPowerDeviceProxy(
            Gio.DBus.system,
            'org.freedesktop.UPower',
            '/org/freedesktop/UPower/devices/DisplayDevice',
            (proxy, error) => {
                if (error) {
                    console.warn('Failed to connect to UPower DisplayDevice:', error.message);
                    return;
                }
                this._batteryPercentage = proxy.Percentage;
                proxy.connect('g-properties-changed', (p, changed) => {
                    const properties = changed.unpack();
                    if ('Percentage' in properties) {
                        this._batteryPercentage = properties.Percentage.unpack();
                        this._updateInhibit();
                    }
                });
                this._updateInhibit();
            }
        );
    }

    _watchMpris() {
        this._sessionBus = Gio.DBus.session;
        
        // Initial list of players
        try {
            const reply = this._sessionBus.call_sync(
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                'ListNames',
                null,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
            const names = reply.get_child_value(0).deepUnpack();
            names.filter(n => typeof n === 'string' && n.startsWith('org.mpris.MediaPlayer2.'))
                 .forEach(n => this._addPlayer(n));
        } catch (e) {
            console.error('Failed to list D-Bus names:', e.message);
        }

        // Watch for new players
        this._sessionBus.signal_subscribe(
            'org.freedesktop.DBus',
            'org.freedesktop.DBus',
            'NameOwnerChanged',
            '/org/freedesktop/DBus',
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, parameters) => {
                const name = parameters.get_child_value(0).deepUnpack();
                const oldOwner = parameters.get_child_value(1).deepUnpack();
                const newOwner = parameters.get_child_value(2).deepUnpack();
                if (typeof name === 'string' && name.startsWith('org.mpris.MediaPlayer2.')) {
                    if (newOwner && !oldOwner) {
                        this._addPlayer(name);
                    } else if (oldOwner && !newOwner) {
                        this._removePlayer(name);
                    }
                }
            }
        );
    }

    _addPlayer(name) {
        if (this._mprisPlayers.has(name)) return;
        
        const proxy = new MprisPlayerProxy(Gio.DBus.session, name, '/org/mpris/MediaPlayer2',
            (p, error) => {
                if (error) return;
                p.connect('g-properties-changed', () => this._checkMediaPlaying());
                this._checkMediaPlaying();
            });
        this._mprisPlayers.set(name, proxy);
    }

    _removePlayer(name) {
        this._mprisPlayers.delete(name);
        this._checkMediaPlaying();
    }

    _checkMediaPlaying() {
        let playing = false;
        for (const proxy of this._mprisPlayers.values()) {
            if (proxy.PlaybackStatus === 'Playing') {
                playing = true;
                break;
            }
        }
        if (this._anyMediaPlaying !== playing) {
            this._anyMediaPlaying = playing;
            this._updateInhibit();
        }
    }

    _updateInhibit() {
        let manualEnabled = false;
        let batteryThreshold = 20;
        
        if (this._settings) {
            manualEnabled = this._settings.get_boolean('enabled');
            batteryThreshold = this._settings.get_int('battery-threshold');
        }

        const batterySafe = !this._onBattery || this._batteryPercentage > batteryThreshold;
        const shouldInhibit = batterySafe && (manualEnabled || this._anyMediaPlaying);

        if (shouldInhibit && !this._inhibitCookie) {
            this._inhibit();
        } else if (!shouldInhibit && this._inhibitCookie) {
            this._uninhibit();
        }
    }

    _inhibit() {
        if (!this._sessionProxy || !this._sessionProxy.g_name_owner) return;

        const reason = this._anyMediaPlaying ? 'Media Playback' : 'Manual Mode';
        // Flags: 4 = Inhibit suspend, 8 = Inhibit idle
        this._sessionProxy.InhibitRemote('org.gnome.KeepAwake', 0, reason, 12, (result, error) => {
            if (error) {
                console.error('Failed to inhibit:', error.message);
                return;
            }
            [this._inhibitCookie] = result;
            console.log(`Keep Awake Active: ${reason} (Cookie: ${this._inhibitCookie})`);
            this._dbusImpl.emit_signal('StateChanged', new GLib.Variant('(bs)', [true, reason]));
        });
    }

    _uninhibit() {
        if (!this._sessionProxy || !this._inhibitCookie) return;

        this._sessionProxy.UninhibitRemote(this._inhibitCookie, (result, error) => {
            if (error) {
                console.error('Failed to uninhibit:', error.message);
                // If it fails because the cookie is invalid, reset it anyway
                if (error.domain === Gio.DBusError)
                    this._inhibitCookie = 0;
                return;
            }
            console.log('Keep Awake Inactive');
            this._inhibitCookie = 0;
            this._dbusImpl.emit_signal('StateChanged', new GLib.Variant('(bs)', [false, 'Safe']));
        });
    }

    ToggleManualMode(enabled) {
        if (this._settings) {
            this._settings.set_boolean('enabled', enabled);
        } else {
            // Fallback if settings are not available
            this._updateInhibit();
        }
    }

    run() {
        Gio.bus_own_name(Gio.BusType.SESSION, 'org.gnome.KeepAwake.Daemon',
            Gio.BusNameOwnerFlags.NONE,
            (conn) => {
                this._dbusImpl.export(conn, '/org/gnome/KeepAwake/Daemon');
                console.log('Daemon exported on D-Bus');
            },
            null,
            () => console.log('Lost name or failed to acquire it'));

        const loop = new GLib.MainLoop(null, false);
        loop.run();
    }
});

const daemon = new KeepAwakeDaemon();
daemon.run();
