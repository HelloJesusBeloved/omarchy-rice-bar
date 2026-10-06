const test = require('node:test');
const assert = require('node:assert/strict');
const GeometryProbe = require('../GeometryProbe.js');

function link(node, parent) {
  node.parent = parent || null;
  const kids = node.children || [];
  for (const child of kids) link(child, node);
  return node;
}

function slot(id, section, x, width, extra = {}) {
  return {
    moduleName: id,
    region: section,
    x,
    y: 0,
    width,
    height: 26,
    visible: true,
    activeItem: { visible: true },
    children: [],
    ...extra
  };
}

test('recognizes ModuleSlot-shaped items and ignores plain layout boxes', () => {
  assert.equal(GeometryProbe.isModuleSlot(slot('omarchy.clock', 'center', 100, 68)), true);
  assert.equal(GeometryProbe.isModuleSlot({ width: 20, height: 26, children: [] }), false);
  assert.equal(GeometryProbe.isModuleSlot(null), false);
});

test('walks the parent tree from a widget to collect every sibling slot on that window', () => {
  const rice = slot('io.github.jcarcinogen.rice-bar', 'right', 1378, 27);
  const window = link({
    screen: { name: 'DP-1' },
    x: 0,
    y: 0,
    width: 1440,
    height: 26,
    children: [
      slot('omarchy.menu', 'left', 8, 27),
      slot('omarchy.workspaces', 'left', 35, 106),
      slot('omarchy.clock', 'center', 686, 68),
      slot('omarchy.audio', 'right', 1351, 27),
      rice
    ]
  });
  const origin = { parent: rice, x: 0, y: 0, width: 27, height: 26 };
  rice.children = [origin];
  origin.parent = rice;

  const geometry = GeometryProbe.geometryFromOrigin(origin);
  assert.deepEqual(geometry.map(item => item.id), [
    'omarchy.menu', 'omarchy.workspaces', 'omarchy.clock', 'omarchy.audio',
    'io.github.jcarcinogen.rice-bar'
  ]);
  assert.equal(geometry[0].section, 'left');
  assert.equal(geometry[2].section, 'center');
  assert.equal(GeometryProbe.screenNameFrom(origin), 'DP-1');
  assert.equal(window.screen.name, 'DP-1');
});

test('prefers a host bar moduleSlots array when the parent chain reaches one', () => {
  const slots = [
    slot('omarchy.menu', 'left', 8, 27),
    slot('omarchy.clock', 'center', 686, 68)
  ];
  const origin = { x: 0, y: 0, width: 27, height: 26 };
  const host = {
    moduleSlots: slots,
    slotWindow: () => ({ screen: { name: 'eDP-1' } }),
    children: slots
  };
  link(host);
  origin.parent = host;
  const geometry = GeometryProbe.geometryForScreen(origin, 'eDP-1');
  assert.equal(geometry.length, 2);
  assert.equal(geometry[1].id, 'omarchy.clock');
});

test('scalar PluginBarStateApi-shaped objects produce no geometry', () => {
  const facade = { barHidden: false, barSize: 26, fontFamily: 'Iosevka', position: 'top' };
  assert.deepEqual(GeometryProbe.geometryForScreen(facade, 'DP-1'), []);
  assert.deepEqual(GeometryProbe.geometryFromOrigin(null), []);
});

test('detects a hidden bar from origin.bar, the parent chain, and off-screen parking', () => {
  assert.equal(GeometryProbe.isBarHidden(null), false);
  assert.equal(GeometryProbe.isBarHidden({ bar: { barHidden: false } }), false);
  assert.equal(GeometryProbe.isBarHidden({ bar: { barHidden: true } }), true);

  const leaf = { x: 0, y: 0, width: 27, height: 26 };
  const host = { barHidden: true, children: [leaf] };
  leaf.parent = host;
  assert.equal(GeometryProbe.isBarHidden(leaf), true);

  const nested = { x: 0 };
  const mid = { bar: { barHidden: true }, children: [nested] };
  nested.parent = mid;
  assert.equal(GeometryProbe.isBarHidden(nested), true);

  assert.equal(GeometryProbe.windowIsParked({ x: 0, y: -26 }, 'top', 26), true);
  assert.equal(GeometryProbe.windowIsParked({ x: 0, y: 0 }, 'top', 26), false);
  assert.equal(GeometryProbe.windowIsParked({ x: -42, y: 0 }, 'left', 42), true);
  assert.equal(GeometryProbe.windowIsParked({ x: 0, y: 1080, screen: { height: 1080, width: 1920 } }, 'bottom', 26), true);
  assert.equal(GeometryProbe.windowIsParked({ x: 1920, y: 0, screen: { height: 1080, width: 1920 } }, 'right', 26), true);
});

test('configFromShell prefers shellConfig and wraps barConfig otherwise', () => {
  const RiceModel = require('../RiceModel.js');
  const id = 'io.github.jcarcinogen.rice-bar';
  const entry = { id, preset: 'glow' };
  assert.deepEqual(RiceModel.findEntry(RiceModel.configFromShell({
    shellConfig: { bar: { layout: { right: [entry] } } }
  }), id), entry);
  assert.deepEqual(RiceModel.findEntry(RiceModel.configFromShell({
    barConfig: { layout: { right: [entry] } }
  }), id), entry);
  assert.deepEqual(RiceModel.configFromShell(null), null);
  assert.deepEqual(RiceModel.findEntry(RiceModel.configFromShell({ bar: {} }), id), {});
});
