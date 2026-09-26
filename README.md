# ScriptUI Dialog Designer

Design your ScriptUI dialogs and export a ready-to-use `.jsx` for Photoshop, Illustrator, InDesign, After Effects or Bridge.

*Inspired by [ScriptUI Dialog Builder](https://scriptui.joonas.me/) by Joonas Pääkkö.*

Use it online: https://lehobb.github.io/ScriptUI-Dialog-Designer/**

## Usage

1. Pick the **target application** (top bar).
2. Build the dialog from the controls palette (click or drag & drop), then tune each element in the inspector.
3. **Download .jsx** and run it from the application.

The exported `.jsx` embeds the layout, so it can be reopened later with **Open ⇧**.

## Offline use

This repository includes a `build` folder that contains the same files as the website. So if the URL doesn't work for some reason, you should be able to download the repo and use it locally (offline). Everything it needs to run is in the `build` folder — no installation, no dependencies. Just open `build/index.html` in your browser.

## Features

- Native ScriptUI controls, plus drawn `Custom` elements, vertical tabs and editable TreeView items
- Code adapted to the target app (`#target`, grouped undo, window types)
- Embedded PNG/JPG images, EN/FR localization, settings persistence
- Live preview with a Test mode, warnings for common ScriptUI pitfalls, undo/redo, snapshots

## License

[MIT](LICENSE)
