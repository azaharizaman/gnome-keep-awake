project('gnome-keep-awake',
  version: '1.0.0',
  meson_version: '>= 0.62.0',
)

i18n = import('i18n')
gnome = import('gnome')

subdir('data')
subdir('src')
subdir('extension')

run_target('enable-extension',
  command: [meson.project_source_root() / 'scripts/enable-extension.sh']
)
