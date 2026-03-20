daemon_conf = configuration_data()
daemon_conf.set('bindir', get_option('prefix') / get_option('bindir'))

configure_file(
  input: 'org.gnome.KeepAwake.Daemon.service.in',
  output: 'org.gnome.KeepAwake.Daemon.service',
  configuration: daemon_conf,
  install_dir: get_option('datadir') / 'dbus-1' / 'services'
)

install_data('daemon.js',
  rename: 'gnome-keep-awake-daemon',
  install_dir: get_option('bindir'),
  install_mode: 'rwxr-xr-x'
)
