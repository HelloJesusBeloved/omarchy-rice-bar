.pragma library

// Shared between the service (which sees PluginBarStateApi.barHidden)
// and the bar-widget (which paints chrome). .pragma library is a singleton
// per plugin, so this does not need Process/FileView in the overlay.

var hidden = false

function setHidden(value) {
  hidden = value === true
}

function isHidden() {
  return hidden === true
}
