# Sly Escape: store submission checklist

## Done in the game (v1.0.0 build 1)
- [x] `BUILD.release` flag (top of the script in `index.html`): forces `unlockAll` off, ignores `?dev=1`, and hides the coin shop unless a real billing provider (`window.SlyBilling`) is attached, so no TEST banners ship.
- [x] Parental gate (`FEATURES.parentalGate`): three digits written as words, typed on a keypad. Shown before purchases, restore, and the privacy/support links.
- [x] Settings screen: sound and music toggles, Restore Purchases (stub), How to Play, Privacy, Support, version.
- [x] Save safety: `SaveIO` storage abstraction with a Capacitor Preferences hook (`SaveIO.attach`), a backup copy, corruption recovery, `SAVE_VERSION` migration, and a `navigator.storage.persist()` request.
- [x] Offline play: `sw.js`. Bump `CACHE` with each release.
- [x] PWA `manifest.json` with icons (any + maskable), standalone display, portrait orientation, theme color.
- [x] Icons in `assets/icons/`:
  - iOS `AppIcon.appiconset` (with Contents.json);
  - Android mipmaps (legacy, round, adaptive foreground/background + XML);
  - Play 512;
  - favicon and apple-touch-icon.
- [x] Launch screens in `assets/splash/`.
- [x] `privacy.html` and `support.html` (terms + FAQ). Contact: slyescape@mail.grokbot.com.

## Still to do
1. Accounts: Apple Developer Program ($99/yr), Google Play Console ($25 one-time, D-U-N-S number if publishing as an organisation). Choose the seller/developer name shown on the store pages.
2. Native wrapper: Capacitor (`npx cap add ios android`), copy in the web build, the icons and the splash screens; bundle id `com.slyescape.app` (or similar). Lock portrait in Xcode and the Android manifest.
3. Billing: add a StoreKit 2 / Google Play Billing plugin, exposed as `window.SlyBilling` with `init/purchase/finish/restore`. Create the 6 products with matching SKUs:
   - 5 consumable coin packs;
   - Starter Pack. Decide whether it is non-consumable (restorable, as coded now) or consumable.
4. Server-side receipt validation (recommended) before granting coins.
5. Attach Capacitor Preferences: `SaveIO.attach(...)` at native boot.
6. Set `BUILD.release=true` and bump the version and build number for each upload.
7. Store listings:
   - title, subtitle and short description, full description, keywords, category Games > Family/Kids;
   - age band (Apple Kids Category: 5 and under / 6-8 / 9-11);
   - screenshots for the required device sizes (6.7"/6.5" iPhone, 12.9" iPad if iPad is supported; Play phone + 7"/10" tablet);
   - optional preview video; Play feature graphic 1024x500.
8. Privacy declarations:
   - Apple App Privacy: "Data Not Collected".
   - Google Data safety: no data collected or shared.
   - Google Families policy declaration and target audience; teacher-approved optional.
   - Content rating questionnaires (IARC / Apple age rating).
9. Host the privacy policy URL (`https://nozispower.github.io/sly-escape/privacy.html`) and the support URL in both consoles.
10. Testing: TestFlight and Play internal testing on real devices (performance on older phones, audio unlock, safe areas/notch, offline, kill and restart save persistence, purchases in sandbox).
11. Legal: confirm the developer name and contact email on the pages, and confirm that the art and audio contain no third-party trademarks.
