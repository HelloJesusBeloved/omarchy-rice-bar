# Changelog

## 0.5.2 — 2026-10-05

Fix 0.5.1 hiding chrome even when the bar is shown.

- Drop the overlay `Process` / `FileView` watcher. Spawning those from the
  bar-widget PanelWindow could fail the loader, so Rice Bar painted nothing.
- Hide only when the stock `bar.barHidden` flag is strictly true.
- Do not treat ancestor `barHidden` properties or off-screen coordinates as
  hidden — those false positives left island/outline chrome permanently gone.

## 0.5.1 — 2026-10-04


Hide rice chrome when the stock bar is hidden.

Omarchy parks `omarchy-bar` off-screen on Super+Shift+Space without unmapping
it. Rice Bar's overlay is a separate `WlrLayer.Bottom` window, so island,
outline, and pill chrome stayed on screen around the empty icon slots.

- Follow `bar.barHidden`, the host object tree, and off-screen parking.
- Watch the same `bar-off` flag the stock bar uses.
- Unmap the overlay, drop paint rects, and park it with matching negative margins.

## 0.5.0 — 2026-09-20

Rebuild for Omarchy 4.0.3+ / 4.0.4.

- Probe widget geometry from the host object tree instead of `bar.moduleSlots`.
- Read settings from `shell.barConfig` when `shell.shellConfig` is absent.
- Guard missing transparency/foreground writes; fall back to `omarchy bar transparent`.
- Open/close the settings panel through `shell.summon` / `hide` / `toggle`.
- Ignore unknown bar signals on the scalar PluginBarStateApi facade.
- Keep Option A stock-bar overlay (`omarchy.bar` stays active).

Fixes GitHub issues #1, #2, and #3.
