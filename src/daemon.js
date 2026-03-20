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

class KeepAwakeDaemon {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJS(DaemonInterface, this);
        this._enabled = false;
        this._inhibitCookie = 0;
    }

    ToggleManualMode(enabled) {
        if (this._enabled === enabled) return;
        this._enabled = enabled;
        console.log(`Keep Awake: ${this._enabled ? 'Enabled' : 'Disabled'} (Manual)`);
        this._dbusImpl.emit_signal('StateChanged', new GLib.Variant('(bs)', [this._enabled, 'Manual']));
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
}

const daemon = new KeepAwakeDaemon();
daemon.run();
