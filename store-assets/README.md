# Store Asset Generator

This folder contains a self‑contained asset generator to export PNGs for the Chrome Web Store and Microsoft Edge Add‑ons.

## What you get

- Brand logo (rendered on canvas)
- Pre‑sized PNG exports:
  - 1280×800 (recommended store screenshot)
  - 640×400 (additional screenshot)
  - Icons: 512, 256, 128, 48, 16
- Light/Dark theming and optional title/subtitle

## How to export

1. Open the generator in your browser:
   - Double‑click `generator.html` (or right‑click → Open with → your browser)
2. Toggle options (Show title, Show subtitle, Dark mode) as you like.
3. Click “Download PNG” next to each preview to save exact‑size images.

> Tip: For Chrome Web Store, upload at least one 1280×800 screenshot. You can also upload multiple screenshots showing the popup and options.

## Where to use

- Chrome Web Store: Developer Dashboard → your item → Store listing → Screenshots
- Microsoft Edge Add‑ons: Partner Center → your extension → Store listing → Images

## Notes

- The extension’s packaged icons (`icons/icon16.png`, `icon48.png`, `icon128.png`) are already present. You can optionally regenerate icons using this tool and replace them.
- The visuals here are vector‑drawn on a `<canvas>` for crisp exports.

## License

Generated assets are part of your project. No third‑party assets are embedded.
