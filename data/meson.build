install_data('org.gnome.KeepAwake.gschema.xml',
  install_dir: get_option('datadir') / 'glib-2.0/schemas'
)

gnome.compile_schemas(
  build_by_default: true,
  depend_files: 'org.gnome.KeepAwake.gschema.xml'
)
