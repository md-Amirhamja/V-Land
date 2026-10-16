# Legacy 3D map regression checklist

Run after every build round (and before tagging). Automated part: `npm run test:e2e -- map-smoke`. Everything below must behave exactly as it did at tag `baseline-3d-map`.

- [ ] `/` loads, the splash disappears, the loading screen hides, Bangladesh appears
- [ ] Division → District → Area drill-down works; the breadcrumb and back / home buttons work
- [ ] Hover tooltips appear
- [ ] Labels float in Bangla; switching to English changes them (`বাংলা` / `English` toggle top-right)
- [ ] Keyboard: arrows rotate/tilt, W A S D pan, + / - zoom, R reset, H home, Esc back
- [ ] Touch controls work on a phone (rotate, pinch, tap to drill)
- [ ] Mapping tool opens (the map-pin button above the controls), draws a polygon, shows area in Bigha, Katha and Decimal, splits among heirs
- [ ] Tapping an **area** now opens the sheet; **Open satellite map** still opens the Google Maps embed and its back button returns to the 3D map
- [ ] Legacy DOM ids still exist: `#c #top #tools #mapview #loading #tip #msg`
- [ ] `git diff baseline-3d-map -- src/main.js` shows only the allowed edits (area-sheet hook, bridge import)
- [ ] Map bundle (`dist/assets/main-*.js`) is within 5% of the baseline 805 kB
