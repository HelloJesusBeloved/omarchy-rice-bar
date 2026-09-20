import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "RiceModel.js" as RiceModel
import "GeometryProbe.js" as GeometryProbe

BarWidget {
  id: root
  moduleName: "io.github.jcarcinogen.rice-bar"

  readonly property bool opened: panelItem ? panelItem.opened === true : false
  readonly property bool popoutSwitchClosing: panelItem ? panelItem.popoutSwitchClosing === true : false
  property var panelItem: null
  property var probedGeometry: []

  readonly property var live: RiceModel.snapshot(root.settings)
  readonly property bool riceActive: live.preset !== "omarchy"
  readonly property string barPosition: bar && bar.position ? String(bar.position) : "top"
  readonly property int resolvedBarSize: bar && Number(bar.barSize) > 0
    ? Number(bar.barSize)
    : ((barPosition === "left" || barPosition === "right") ? Style.bar.sizeVertical : Style.bar.sizeHorizontal)
  readonly property bool barSurfaceVisible: {
    try {
      var window = root.QsWindow ? root.QsWindow.window : null
      if (window && window.visible === false) return false
    } catch (error) {}
    return root.visible !== false
  }

  function open() { if (panelItem) panelItem.open() }
  function close() { if (panelItem) panelItem.close() }
  function togglePanel() { if (panelItem) panelItem.toggle() }
  function closeForPopoutSwitch() { if (panelItem) panelItem.closeForPopoutSwitch() }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    panelItem = target
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  function childList(item) {
    return GeometryProbe.childList(item)
  }

  function isSlotSized(item) {
    if (!item) return false
    var w = Number(item.width) || Number(item.implicitWidth) || 0
    var h = Number(item.height) || Number(item.implicitHeight) || 0
    return RiceModel.isSlotSized(w, h, root.resolvedBarSize)
  }

  function gatherSlotSized(item, acc) {
    if (!item || item.visible === false) return
    if (isSlotSized(item)) acc.push(item)
    var children = childList(item)
    for (var i = 0; i < children.length; i++)
      gatherSlotSized(children[i], acc)
  }

  function leafOverlaps(leafPoint, leaf, parentPoint, parent) {
    var ly = Number(leafPoint.y)
    var lh = Number(leaf.height) || Number(leaf.implicitHeight) || 0
    var py = Number(parentPoint.y)
    var ph = Number(parent.height) || Number(root.resolvedBarSize) || 26
    var overlapH = Math.min(ly + lh, py + ph) - Math.max(ly, py)
    return overlapH > lh * 0.4
  }

  function trayLeaves(slot, point) {
    var leaves = []
    if (!slot || String(slot.moduleName) !== "omarchy.tray") return leaves
    var icons = []
    gatherSlotSized(slot.activeItem, icons)
    for (var j = 0; j < icons.length; j++) {
      var leaf = icons[j]
      var lp = { x: point.x, y: point.y }
      try { lp = leaf.mapToItem(null, 0, 0) } catch (error) {}
      if (!leafOverlaps(lp, leaf, point, slot)) continue
      leaves.push({
        id: "omarchy.tray." + leaves.length,
        section: String(slot.region || ""),
        x: Math.round(lp.x),
        y: Math.round(lp.y),
        width: Math.round(Number(leaf.width) || Number(leaf.implicitWidth) || 0),
        height: Math.round(Number(leaf.height) || Number(leaf.implicitHeight) || 0),
        visible: true,
        itemVisible: true
      })
    }
    return leaves
  }

  function probeGeometry() {
    var screenName = GeometryProbe.screenNameFrom(root)
    probedGeometry = GeometryProbe.geometryForScreen(root, screenName, trayLeaves)
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Timer {
    interval: 250
    repeat: true
    running: root.riceActive && root.barSurfaceVisible
    triggeredOnStart: true
    onTriggered: root.probeGeometry()
  }

  Loader {
    id: chromeLoader
    active: true
    source: Qt.resolvedUrl("RiceChrome.qml")
    onLoaded: {
      var chrome = item
      if (!chrome) return
      chrome.live = Qt.binding(function() { return root.live })
      chrome.preset = Qt.binding(function() { return root.live.preset })
      chrome.widgetGeometry = Qt.binding(function() { return root.probedGeometry })
      chrome.position = Qt.binding(function() { return root.barPosition })
      chrome.barSize = Qt.binding(function() { return root.resolvedBarSize })
      chrome.riceActive = Qt.binding(function() { return root.riceActive })
      chrome.barHidden = Qt.binding(function() { return !root.barSurfaceVisible })
      try {
        var window = root.QsWindow ? root.QsWindow.window : null
        if (window && window.screen) chrome.screen = window.screen
      } catch (error) {}
    }
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("RicePanel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰟪"
    tooltipText: root.opened ? "Close Rice Bar styles" : "Rice Bar styles"
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) root.togglePanel()
    }
  }
}
