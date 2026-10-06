function childList(item) {
  if (!item) return []
  var list = []
  var children = item.children
  if (children && children.length) {
    for (var i = 0; i < children.length; i++) list.push(children[i])
  }
  if (list.length) return list
  var data = item.data
  if (data && data.length) {
    for (var d = 0; d < data.length; d++) {
      if (data[d] && (data[d].width !== undefined || data[d].implicitWidth !== undefined || data[d].moduleName !== undefined))
        list.push(data[d])
    }
  }
  return list
}

function isModuleSlot(item) {
  if (!item || typeof item !== "object") return false
  if (item.moduleName === undefined || item.region === undefined) return false
  return Object.prototype.hasOwnProperty.call(item, "activeItem")
    || item.activeItem !== undefined
}

function parentChain(item, max) {
  var chain = []
  var current = item
  var guard = 0
  var limit = max || 28
  while (current && guard++ < limit) {
    chain.push(current)
    current = current.parent
  }
  return chain
}

function findHostBar(origin) {
  var chain = parentChain(origin)
  for (var i = 0; i < chain.length; i++) {
    var item = chain[i]
    if (item && Array.isArray(item.moduleSlots) && item.moduleSlots.length)
      return item
  }
  return null
}

function findOwnSlot(origin) {
  var chain = parentChain(origin)
  for (var i = 0; i < chain.length; i++) {
    if (isModuleSlot(chain[i])) return chain[i]
  }
  return null
}

function gatherSlots(item, acc, depth) {
  if (!item || depth > 16) return
  if (isModuleSlot(item)) {
    acc.push(item)
    return
  }
  var children = childList(item)
  for (var i = 0; i < children.length; i++) gatherSlots(children[i], acc, depth + 1)
}

function findSearchRoot(slot) {
  var current = slot
  var best = slot
  var bestCount = 1
  var guard = 0
  while (current && guard++ < 18) {
    var acc = []
    gatherSlots(current, acc, 0)
    if (acc.length >= bestCount) {
      best = current
      bestCount = acc.length
    }
    if (current.screen && current.screen.name) return current
    current = current.parent
  }
  return best
}

function mapPoint(item) {
  var point = { x: Number(item.x) || 0, y: Number(item.y) || 0 }
  if (typeof item.mapToItem === "function") {
    try {
      var mapped = item.mapToItem(null, 0, 0)
      if (mapped && mapped.x !== undefined) point = mapped
    } catch (error) {}
  }
  return point
}

function slotWindowOf(bar, slot) {
  if (bar && typeof bar.slotWindow === "function") {
    try { return bar.slotWindow(slot) } catch (error) {}
  }
  var chain = parentChain(slot)
  for (var i = 0; i < chain.length; i++) {
    if (chain[i] && chain[i].screen && chain[i].screen.name) return chain[i]
  }
  return null
}

function slotRecord(slot, trayLeavesFn) {
  var point = mapPoint(slot)
  var active = slot.activeItem
  var rec = {
    id: String(slot.moduleName || ""),
    section: String(slot.region || ""),
    x: Math.round(point.x),
    y: Math.round(point.y),
    width: Math.round(Number(slot.width) || 0),
    height: Math.round(Number(slot.height) || 0),
    visible: slot.visible !== false && Number(slot.width) > 0 && Number(slot.height) > 0,
    itemVisible: active ? active.visible !== false : true,
    leaves: []
  }
  if (typeof trayLeavesFn === "function") {
    try { rec.leaves = trayLeavesFn(slot, point) || [] } catch (error) { rec.leaves = [] }
  }
  return rec
}

function geometryFromModuleSlots(bar, screenName, trayLeavesFn) {
  var result = []
  if (!bar || !Array.isArray(bar.moduleSlots)) return result
  for (var i = 0; i < bar.moduleSlots.length; i++) {
    var slot = bar.moduleSlots[i]
    if (!slot || !slot.activeItem) continue
    var window = slotWindowOf(bar, slot)
    if (screenName && window && window.screen && String(window.screen.name) !== String(screenName))
      continue
    result.push(slotRecord(slot, trayLeavesFn))
  }
  return result
}

function geometryFromOrigin(origin, trayLeavesFn) {
  if (!origin) return []
  var host = findHostBar(origin)
  var screenName = screenNameFrom(origin)
  if (host) return geometryFromModuleSlots(host, screenName, trayLeavesFn)
  var slot = findOwnSlot(origin)
  if (!slot) return []
  var root = findSearchRoot(slot)
  var slots = []
  gatherSlots(root, slots, 0)
  var result = []
  for (var i = 0; i < slots.length; i++) result.push(slotRecord(slots[i], trayLeavesFn))
  return result
}

function screenNameFrom(origin) {
  var chain = parentChain(origin)
  for (var i = 0; i < chain.length; i++) {
    if (chain[i] && chain[i].screen && chain[i].screen.name)
      return String(chain[i].screen.name)
  }
  try {
    if (origin && origin.QsWindow && origin.QsWindow.window && origin.QsWindow.window.screen)
      return String(origin.QsWindow.window.screen.name)
  } catch (error) {}
  return ""
}

function geometryForScreen(source, screenName, trayLeavesFn) {
  if (source && Array.isArray(source.moduleSlots))
    return geometryFromModuleSlots(source, screenName, trayLeavesFn)
  return geometryFromOrigin(source, trayLeavesFn)
}

function isBarHidden(origin) {
  if (!origin) return false
  try {
    return !!(origin.bar && origin.bar.barHidden === true)
  } catch (error) {
    return false
  }
}

function windowIsParked(window, position, barSize) {
  if (!window) return false
  var size = Number(barSize) || 26
  var pos = String(position || "top")
  var x = Number(window.x)
  var y = Number(window.y)
  if (pos === "top" && y <= 1 - size) return true
  if (pos === "left" && x <= 1 - size) return true
  var screen = window.screen
  if (!screen) return false
  if (pos === "bottom" && y >= Number(screen.height) - 1) return true
  if (pos === "right" && x >= Number(screen.width) - 1) return true
  return false
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    childList: childList,
    isModuleSlot: isModuleSlot,
    parentChain: parentChain,
    findHostBar: findHostBar,
    findOwnSlot: findOwnSlot,
    gatherSlots: gatherSlots,
    findSearchRoot: findSearchRoot,
    mapPoint: mapPoint,
    slotRecord: slotRecord,
    geometryFromModuleSlots: geometryFromModuleSlots,
    geometryFromOrigin: geometryFromOrigin,
    geometryForScreen: geometryForScreen,
    screenNameFrom: screenNameFrom,
    isBarHidden: isBarHidden,
    windowIsParked: windowIsParked
  }
}
