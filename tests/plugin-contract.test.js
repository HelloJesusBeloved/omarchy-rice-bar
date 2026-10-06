const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function source(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

test('manifest declares a stock-bar overlay with selectable presets', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, 'io.github.jcarcinogen.rice-bar');
  assert.equal(manifest.version, '0.5.3');
  assert.deepEqual(manifest.kinds, ['service', 'bar-widget']);
  assert.equal(manifest.entryPoints.service, 'Service.qml');
  assert.equal(manifest.entryPoints.barWidget, 'BarWidget.qml');
  assert.equal(manifest.barWidget.defaultSection, 'right');
  assert.equal(manifest.barWidget.defaults.preset, 'islands');
  const preset = manifest.barWidget.schema.find(entry => entry.key === 'preset');
  assert.deepEqual(preset.options, [
    'Omarchy', 'Islands', 'Pills', 'Material', 'Outline',
    'Rail', 'Bracket', 'Glow', 'Powerline', 'Mono', 'Minimal'
  ]);
});

test('service remains an Option A overlay instead of a replacement bar', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.equal(manifest.kinds.includes('bar'), false);
  const overlay = source('RiceOverlay.qml');
  const chrome = source('RiceChrome.qml');
  assert.match(overlay, /WlrLayer\.Bottom/);
  assert.match(overlay, /mask:\s*Region\s*\{\s*\}/);
  assert.match(chrome, /Color\.bar\.background/);
  assert.match(chrome, /Color\.accent/);
});

test('service imports the Quickshell modules required by its runtime types', () => {
  const service = source('Service.qml');
  assert.match(service, /import Quickshell\.Io/);
  const overlay = source('RiceOverlay.qml');
  assert.match(overlay, /import Quickshell\.Wayland/);
});

test('4.0.4 settings are read from barConfig when shellConfig is absent', () => {
  const service = source('Service.qml');
  assert.match(service, /RiceModel\.configFromShell\(shell\)/);
  assert.match(service, /RiceModel\.findEntry\(pluginConfig,\s*pluginId\)/);
  assert.doesNotMatch(service, /shell\.shellConfig/);
});

test('rice transparency is reapplied after stock config updates finish', () => {
  const service = source('Service.qml');
  assert.match(service, /onPresetChanged:\s*Qt\.callLater\(root\.applyBarMode\)/);
  assert.match(service, /onRequestedTransparentChanged\(\)[\s\S]*Qt\.callLater\(root\.applyBarMode\)/);
  assert.match(service, /ignoreUnknownSignals:\s*true/);
});

test('stock transparency capture survives a bar rebind', () => {
  const service = source('Service.qml');
  assert.match(service, /onBarChanged:\s*Qt\.callLater\(root\.applyBarMode\)/);
  assert.doesNotMatch(service, /onBarChanged:[\s\S]{0,120}stockStateCaptured\s*=\s*false/);
});

test('transparency writes are guarded and fall back to the public bar CLI', () => {
  const service = source('Service.qml');
  assert.match(service, /setRequestedTransparency/);
  assert.match(service, /omarchy["'][\s\S]{0,80}bar/);
  assert.match(service, /transparent/);
  assert.match(service, /hasBarProp/);
  assert.match(service, /foregroundAnimationEnabled/);
});

test('geometry is probed from the host object tree instead of bar.moduleSlots', () => {
  const widget = source('BarWidget.qml');
  assert.match(widget, /GeometryProbe/);
  assert.match(widget, /geometryForScreen/);
  assert.match(widget, /probedGeometry/);
  assert.match(widget, /trayLeaves/);
  const probe = source('GeometryProbe.js');
  assert.match(probe, /isModuleSlot/);
  assert.match(probe, /geometryFromOrigin/);
  assert.match(probe, /moduleSlots/);
});

test('visible settings control participates in Rice Bar surface geometry', () => {
  const chrome = source('RiceChrome.qml');
  assert.doesNotMatch(chrome, /(?:pillRects|islandRects)\([^\n]*pluginId/);
});

test('settings control uses the rice-bowl glyph and never replaces Omarchy branding', () => {
  const rice = '\u{F07EA}';
  const widget = source('BarWidget.qml');
  const panel = source('RicePanel.qml');
  assert.match(widget, /BarIconButton/);
  assert.match(widget, new RegExp(rice));
  assert.match(panel, new RegExp(rice));
  assert.doesNotMatch(widget, /text:\s*["'](?:OMARCHY|Omarchy)["']/);
  assert.doesNotMatch(widget, /moduleName:\s*["']omarchy\./);
});

test('pills collect per-icon tray leaves from the stock overlay', () => {
  const widget = source('BarWidget.qml');
  assert.match(widget, /omarchy\.tray/);
  assert.match(widget, /gatherSlotSized/);
  assert.match(widget, /trayLeaves/);
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /var separated = RiceModel\.separateRects\(rects, axis, 2\)[\s\S]{0,180}RiceModel\.balanceMenuPill\(separated, axis\)/);
});

test('all selectable presets are exposed by the panel and delegated to paint recipes', () => {
  const chrome = source('RiceChrome.qml');
  const panel = source('RicePanel.qml');
  assert.match(chrome, /RiceModel\.paintRecipe\(preset\)/);
  for (const preset of [
    'omarchy', 'islands', 'pills', 'material', 'outline',
    'rail', 'bracket', 'glow', 'powerline', 'mono', 'minimal'
  ]) {
    assert.match(panel, new RegExp(`value:\\s*['"]${preset}['"]`));
  }
});

test('panel and IPC use per-style profiles with a current-style defaults button', () => {
  const service = source('Service.qml');
  const panel = source('RicePanel.qml');
  assert.match(service, /RiceModel\.switchPreset\(pluginEntry,\s*value\)/);
  assert.match(panel, /RiceModel\.switchPreset\(settings,\s*value\)/);
  assert.match(panel, /RiceModel\.updateAppearance\(settings,\s*values\)/);
  assert.match(panel, /RiceModel\.resetPreset\(settings\)/);
  assert.match(panel, /Restore "\s*\+\s*root\.styleLabel\(root\.live\.preset\)\s*\+\s*" defaults/);
  assert.doesNotMatch(panel, /Restore default bar/);
});

test('style dropdown stays synchronized after external preset changes', () => {
  const panel = source('RicePanel.qml');
  assert.match(panel, /Dropdown\s*\{[\s\S]{0,80}id:\s*styleDropdown/);
  assert.match(panel, /Binding\s*\{[\s\S]{0,100}target:\s*styleDropdown[\s\S]{0,100}value:\s*root\.live\.preset/);
});

test('appearance controls are disabled only for the unmodified Default preset', () => {
  const panel = source('RicePanel.qml');
  assert.match(panel, /readonly property bool appearanceControlsEnabled:\s*live\.preset\s*!==\s*["']omarchy["']/);
  assert.equal((panel.match(/enabled:\s*root\.appearanceControlsEnabled/g) || []).length, 4);
});

test('renderer derives adaptive contrast surfaces from reactive Omarchy theme colors', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /RiceModel\.contrastSurface\([\s\S]{0,100}Color\.bar\.background,\s*Color\.bar\.text,\s*Color\.accent\)/);
  assert.match(chrome, /RiceModel\.visibleAlpha\(live\.opacity,\s*0\.32\)/);
  assert.match(chrome, /readonly property color adaptiveSurface:/);
  assert.match(chrome, /readonly property color adaptiveAccent:/);
  assert.match(chrome, /readonly property var contrastSurfaces:/);
  assert.match(chrome, /RiceModel\.readableCompositePlan\([\s\S]{0,180}contrastSurfaces/);
  assert.match(chrome, /readonly property real surfaceAlpha:\s*contrastPlan\.alpha/);
  assert.match(chrome, /id:\s*sparseBackplates/);
  assert.match(chrome, /model:\s*riceWindow\.recipe\.decoration\s*===\s*["']rail["'][\s\S]{0,160}bracket[\s\S]{0,160}minimal[\s\S]{0,120}\?\s*riceWindow\.paintRects\s*:\s*\[\]/);
});

test('every filled recipe uses the contrast-planned alpha for its actual painted surface', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /if \(material\) return riceWindow\.colorWithAlpha\(riceWindow\.materialSurface,\s*alpha\)/);
  assert.match(chrome, /if \(outline\) return riceWindow\.colorWithAlpha\(riceWindow\.adaptiveSurface,\s*alpha\)/);
  assert.match(chrome, /if \(glow\) return riceWindow\.colorWithAlpha\(Qt\.darker\(riceWindow\.adaptiveSurface,\s*1\.28\),\s*alpha\)/);
  assert.match(chrome, /if \(mono\) return riceWindow\.colorWithAlpha\(Qt\.darker\(riceWindow\.adaptiveSurface,\s*1\.38\),\s*alpha\)/);
  assert.doesNotMatch(chrome, /if \(outline\)[^\n]*Math\.max\(0\.34/);
});

test('all visual bar outlines follow the reactive Hyprland active-window border token', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /readonly property color themeBorderColor:\s*Color\.flatColor\([\s\S]{0,140}Color\.pick\(["']hyprland\.active-border["'],\s*Color\.accent\)/);
  assert.match(chrome, /id:\s*continuousRail[\s\S]{0,120}color:\s*riceWindow\.themeBorderColor/);
  assert.match(chrome, /readonly property color edgeRuleColor:\s*riceWindow\.themeBorderColor/);
  assert.match(chrome, /readonly property color outlineColor:[\s\S]{0,120}return riceWindow\.themeBorderColor/);
  assert.match(chrome, /strokeColor:\s*riceWindow\.themeBorderColor/);
  assert.match(chrome, /readonly property color bracketColor:\s*riceWindow\.themeBorderColor/);
  assert.doesNotMatch(chrome, /border\.color:\s*root\.adaptiveAccent/);
});

test('every style paint path honors exposed opacity radius and border controls', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /readonly property real opacityFactor:\s*riceWindow\.live\.opacity\s*\/\s*100/);
  assert.match(chrome, /readonly property int powerlineCut:[\s\S]{0,120}riceWindow\.live\.radius/);
  assert.match(chrome, /radius:\s*Math\.min\(riceWindow\.live\.radius,\s*rule\s*\/\s*2\)/);
  assert.match(chrome, /if\s*\(!riceWindow\.live\.border\)\s*return\s*["']transparent["']/);
  assert.match(chrome, /visible:\s*surface\.glow\s*&&\s*riceWindow\.live\.border/);
  assert.match(chrome, /bracketColor:\s*riceWindow\.themeBorderColor/);
  assert.match(chrome, /edgeRuleColor:\s*riceWindow\.themeBorderColor/);
});

test('filled surfaces inset their background inside the visible border', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /id:\s*baseSurface[\s\S]{0,220}color:\s*["']transparent["']/);
  assert.match(chrome, /id:\s*innerFill[\s\S]{0,180}anchors\.margins:\s*baseSurface\.border\.width/);
  assert.match(chrome, /id:\s*innerFill[\s\S]{0,220}color:\s*surface\.fillColor/);
  assert.doesNotMatch(chrome, /id:\s*baseSurface[\s\S]{0,220}color:\s*surface\.fillColor/);
  assert.match(chrome, /ShapePath\s*\{[\s\S]{0,180}strokeWidth:\s*riceWindow\.live\.border\s*\?\s*1\s*:\s*0[\s\S]{0,180}fillColor:\s*surface\.fillColor/);
});

test('sparse readability backplates are instantiated only for sparse styles', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /id:\s*sparseBackplates[\s\S]{0,220}model:\s*riceWindow\.recipe\.decoration\s*===\s*["']rail["'][\s\S]{0,180}\?\s*riceWindow\.paintRects\s*:\s*\[\]/);
  assert.doesNotMatch(chrome, /id:\s*sparseBackplates\s*\n\s*model:\s*riceWindow\.paintRects/);
});

test('overlay samples geometry imperatively instead of binding mapToItem into PanelWindow geometry', () => {
  const widget = source('BarWidget.qml');
  assert.match(widget, /property var probedGeometry:\s*\[\]/);
  assert.match(widget, /onTriggered:\s*root\.probeGeometry\(\)/);
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /property var widgetGeometry:\s*\[\]/);
});

test('special styles are passive paint decorations over section geometry', () => {
  const chrome = source('RiceChrome.qml');
  assert.match(chrome, /RiceModel\.paintRecipe/);
  assert.match(chrome, /decoration\s*===\s*["']material["']/);
  assert.match(chrome, /decoration\s*===\s*["']outline["']/);
  assert.match(chrome, /decoration\s*===\s*["']rail["']/);
  assert.match(chrome, /decoration\s*===\s*["']bracket["']/);
  assert.match(chrome, /decoration\s*===\s*["']glow["']/);
  assert.match(chrome, /decoration\s*===\s*["']powerline["']/);
  assert.match(chrome, /decoration\s*===\s*["']mono["']/);
  assert.doesNotMatch(chrome, /WlrKeyboardFocus\.Exclusive|MouseArea|TapHandler/);
});

test('IPC panel actions prefer the scoped shell summon API', () => {
  const service = source('Service.qml');
  assert.match(service, /shell\.summon\(pluginId\)/);
  assert.match(service, /shell\.hide\(pluginId\)/);
  assert.match(service, /shell\.toggle\(pluginId\)/);
});

test('overlay hides with the stock bar via in-window hosting and a service bridge', () => {
  const widget = source('BarWidget.qml');
  const chrome = source('RiceChrome.qml');
  const overlay = source('RiceOverlay.qml');
  const service = source('Service.qml');
  const bridge = source('RiceBridge.js');
  assert.match(bridge, /\.pragma library/);
  assert.match(service, /RiceBridge\.setHidden\(root\.barHidden\)/);
  assert.match(widget, /RiceBridge\.isHidden\(\)/);
  assert.match(widget, /hostChrome/);
  assert.match(widget, /findChromeHost/);
  assert.match(widget, /GeometryProbe\.windowIsParked/);
  assert.match(widget, /hostedLoader/);
  assert.match(widget, /overlayLoader/);
  assert.match(chrome, /^Item \{/m);
  assert.match(chrome, /enabled:\s*false/);
  assert.doesNotMatch(chrome, /PanelWindow|Quickshell\.Io|FileView|bar-off/);
  assert.match(overlay, /PanelWindow/);
  assert.match(overlay, /visible:\s*rice\.riceActive && !rice\.barHidden/);
});

test('Glass is absent from every selectable and paint source', () => {
  for (const name of ['manifest.json', 'RicePanel.qml', 'Service.qml', 'RiceChrome.qml', 'RiceOverlay.qml', 'README.md'])
    assert.doesNotMatch(source(name), /glass/i, name);
});
