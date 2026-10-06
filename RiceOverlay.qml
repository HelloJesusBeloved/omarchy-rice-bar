import QtQuick
import Quickshell
import Quickshell.Wayland
import qs.Commons
import qs.Ui

// Fallback when chrome cannot be parented into the stock bar window.
// Independent Bottom-layer surface; hide is driven by barHidden.
PanelWindow {
  id: overlay

  property alias live: rice.live
  property alias preset: rice.preset
  property alias widgetGeometry: rice.widgetGeometry
  property alias position: rice.position
  property alias barSize: rice.barSize
  property alias riceActive: rice.riceActive
  property alias barHidden: rice.barHidden

  color: "transparent"
  exclusionMode: ExclusionMode.Ignore
  surfaceFormat.opaque: false
  visible: rice.riceActive && !rice.barHidden && rice.span > 0 && !remapGuard.remapping && rice.paintRects.length > 0
  implicitWidth: rice.edgeVertical ? rice.span : 0
  implicitHeight: rice.edgeVertical ? 0 : rice.span

  anchors {
    top: rice.position === "top" || rice.edgeVertical
    bottom: rice.position === "bottom" || rice.edgeVertical
    left: rice.position === "left" || !rice.edgeVertical
    right: rice.position === "right" || !rice.edgeVertical
  }

  ScreenMoveRemap {
    id: remapGuard
    window: overlay
  }

  WlrLayershell.namespace: "omarchy-rice-bar"
  WlrLayershell.layer: WlrLayer.Bottom
  WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

  mask: Region {}

  RiceChrome {
    id: rice
    anchors.fill: parent
  }
}
