# Changelog

## 0.5.0 — 2026-09-20

Rebuild for Omarchy 4.0.3+ / 4.0.4.

- Probe widget geometry from the host object tree instead of `bar.moduleSlots`.
- Read settings from `shell.barConfig` when `shell.shellConfig` is absent.
- Guard missing transparency/foreground writes; fall back to `omarchy bar transparent`.
- Open/close the settings panel through `shell.summon` / `hide` / `toggle`.
- Ignore unknown bar signals on the scalar PluginBarStateApi facade.
- Keep Option A stock-bar overlay (`omarchy.bar` stays active).

Fixes GitHub issues #1, #2, and #3.
