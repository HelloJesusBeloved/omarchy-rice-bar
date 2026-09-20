import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "RiceModel.js" as RiceModel

// Headless singleton for Omarchy 4.0.3+ / 4.0.4.
// IPC + stock-bar transparency. Chrome is painted by RiceChrome from the
// bar-widget, which can still see sibling ModuleSlots in the host object tree.
Item {
  id: root

  property var shell: null
  property var manifest: null
  property string omarchyPath: ""

  readonly property string pluginId: manifest && manifest.id
    ? String(manifest.id) : "io.github.jcarcinogen.rice-bar"
  readonly property var bar: shell && shell.bar ? shell.bar : null
  readonly property var pluginConfig: RiceModel.configFromShell(shell)
  readonly property var pluginEntry: RiceModel.findEntry(pluginConfig, pluginId)
  readonly property var live: RiceModel.snapshot(pluginEntry)
  readonly property string preset: live.preset
  readonly property bool riceActive: preset !== "omarchy"
  readonly property bool barHidden: bar && "barHidden" in bar ? bar.barHidden === true : false
  readonly property string position: bar && bar.position ? String(bar.position) : "top"

  property bool stockStateCaptured: false
  property bool stockRequestedTransparent: false
  property bool applyingTransparency: false

  function hasBarMethod(name) {
    return !!(bar && typeof bar[name] === "function")
  }

  function hasBarProp(name) {
    if (!bar) return false
    try { return bar[name] !== undefined } catch (error) { return false }
  }

  function captureStockState() {
    if (stockStateCaptured) return
    if (hasBarProp("requestedTransparent"))
      stockRequestedTransparent = bar.requestedTransparent === true
    else if (pluginConfig && pluginConfig.bar && pluginConfig.bar.transparent === true)
      stockRequestedTransparent = true
    else if (shell && shell.barConfig && shell.barConfig.transparent === true)
      stockRequestedTransparent = true
    else if (hasBarProp("transparent"))
      stockRequestedTransparent = bar.transparent === true
    stockStateCaptured = true
  }

  function runBarCli(args) {
    barCmd.running = false
    barCmd.command = ["omarchy", "bar"].concat(args)
    barCmd.running = true
  }

  function setStockTransparent(value) {
    var next = value === true
    if (hasBarMethod("setRequestedTransparency")) {
      bar.setRequestedTransparency(next)
      return
    }
    if (shell && typeof shell.mutateShellConfig === "function") {
      var mutated = shell.mutateShellConfig(function(scoped) {
        if (!scoped) return
        if (scoped.bar && typeof scoped.bar === "object") scoped.bar.transparent = next
        else scoped.transparent = next
      })
      if (mutated) return
    }
    runBarCli(["transparent", next ? "true" : "false"])
  }

  function useThemeForeground() {
    if (!riceActive || !bar) return
    if (!hasBarProp("transparentForeground") && !hasBarProp("useTransparentForeground"))
      return
    try {
      if (hasBarProp("foregroundAnimationEnabled")) bar.foregroundAnimationEnabled = false
      if (hasBarProp("transparentForeground"))
      bar.transparentForeground = Color.bar.text
      if (hasBarProp("useTransparentForeground")) bar.useTransparentForeground = true
    } catch (error) {}
    Qt.callLater(function() {
      try {
        if (root.bar && root.hasBarProp("foregroundAnimationEnabled"))
          root.bar.foregroundAnimationEnabled = true
      } catch (ignored) {}
    })
  }

  function applyBarMode() {
    captureStockState()
    applyingTransparency = true
    if (riceActive) {
      setStockTransparent(true)
      useThemeForeground()
    } else {
      setStockTransparent(stockRequestedTransparent)
    }
    Qt.callLater(function() { root.applyingTransparency = false })
  }

  function restoreStockState() {
    if (!stockStateCaptured) return
    setStockTransparent(stockRequestedTransparent)
  }

  function persistPreset(value) {
    if (!shell || typeof shell.updateEntryInline !== "function") return false
    var next = RiceModel.switchPreset(pluginEntry, value)
    return shell.updateEntryInline(pluginId, next)
  }

  function panelAction(action) {
    if (shell) {
      if (action === "open" && typeof shell.summon === "function")
        return shell.summon(pluginId) === true
      if (action === "close" && typeof shell.hide === "function")
        return shell.hide(pluginId) === true
      if (action === "toggle" && typeof shell.toggle === "function")
        return shell.toggle(pluginId) === true
      if (action === "toggle") {
        var opened = typeof shell.isPluginOpen === "function" && shell.isPluginOpen(pluginId)
        return opened ? panelAction("close") : panelAction("open")
      }
    }
    if (!bar) return false
    if (action === "open" && typeof bar.summonBarWidget === "function")
      return bar.summonBarWidget(pluginId) === true
    if (action === "close" && typeof bar.hideBarWidget === "function")
      return bar.hideBarWidget(pluginId) === true
    return false
  }

  onBarChanged: Qt.callLater(root.applyBarMode)
  onPresetChanged: Qt.callLater(root.applyBarMode)

  Connections {
    target: root.bar
    ignoreUnknownSignals: true
    function onTransparentForegroundChanged() { root.useThemeForeground() }
    function onRequestedTransparentChanged() {
      if (root.applyingTransparency) return
      if (root.riceActive && root.bar && root.bar.requestedTransparent === false)
        Qt.callLater(root.applyBarMode)
    }
    function onTransparentChanged() {
      if (root.applyingTransparency) return
      if (root.riceActive && root.bar && root.bar.transparent === false)
        Qt.callLater(root.applyBarMode)
    }
  }

  Connections {
    target: Color.bar
    ignoreUnknownSignals: true
    function onTextChanged() { root.useThemeForeground() }
    function onBackgroundChanged() { root.useThemeForeground() }
  }

  Connections {
    target: Color
    ignoreUnknownSignals: true
    function onAccentChanged() { root.useThemeForeground() }
  }

  Process {
    id: barCmd
    running: false
  }

  Timer {
    interval: 0
    running: true
    repeat: false
    onTriggered: root.applyBarMode()
  }

  IpcHandler {
    target: "rice-bar"

    function status(): string {
      return JSON.stringify({
        id: root.pluginId,
        architecture: "stock-overlay",
        host: "omarchy-4.0.4",
        preset: root.preset,
        shown: root.riceActive && !root.barHidden,
        position: root.position,
        stockBar: root.bar ? true : false,
        stockRequestedTransparent: root.stockRequestedTransparent,
        geometrySource: "host-object-tree"
      })
    }

    function style(value: string): string {
      var preset = RiceModel.normalizePreset(value)
      root.persistPreset(preset)
      return preset
    }

    function open(): void { root.panelAction("open") }
    function close(): void { root.panelAction("close") }
    function toggle(): void { root.panelAction("toggle") }
  }

  Component.onDestruction: restoreStockState()
}
