# Tradarr premium animation upgrade — 20 November 2026

## Implemented in GitHub main

**Interaction design (Motion.tsx):**
- Replaced deep spring press bounce with a 98ms controlled press-down and 205ms cubic release. The default scale is 0.977, with a ~1.7px lift response and a brief teal highlight that honours the target button's own border radius. It preserves the action/accessibility props and never intercepts taps.
- Customer and trader screens now enter in the direction of travel with a measured fade and subtle depth change. The bottom navigation stays fixed. Native WebView-heavy map screens use smaller, shorter transforms to reduce compositing cost.
- Navigation-pill selection smoothly settles; icon gains a slight elevation and scale. Inbox switches have their own short transition and slide.
- Home CTA sections use staggered, single-shot entrance animations without changing their widths, heights, grid, or clipping rules.
- Reduced Motion changes are listened to while the app is running. Long-running decorative animations stop when the user turns Reduced Motion on; map WebViews also respect CSS `prefers-reduced-motion`.

**Maps:**
- Customer trader pins now reveal with a short ease-out rather than dropping and bouncing. Cluster colours match the teal/warm white design. Selected pins receive one orange focus ring rather than repeated scaling.
- Dense map scenes (more than 65 visible marker/cluster elements) disable marker entrance and online pulses to prevent costly simultaneous animation. Existing 10,000-marker geometry regression stays in CI.
- Selecting a trader moves the chosen pin above the bottom details card rather than behind it.
- The customer map initially stays focused on the searched area. It no longer calls `fitBounds` for every profile spread across the UK, which previously could zoom out to a meaningless overview.
- Merchant markers now settle gently; selected-store detail sheet enters with a native-driven fade/slide. Marker focus stays above the card, and decorative straight-line route dots and false route animation were removed. Real directions still open the navigation app.
- Home merchant preview is brighter/readable and its glow is a one-shot arrival effect, not a perpetual animation.

**Regression protection:**
- Existing `npm run check:syntax`, `npm run check:ux`, `npm run typecheck`, booking logic and 10,000-marker cluster tests remain in CI.
- `scripts/test-motion-visuals.cjs` parses JavaScript embedded in all three map HTML strings and checks reduced-motion support, non-deceptive route focus and the new animation assumptions. This proves syntax and intended hooks, *not* actual iPhone frame pacing.

## Follow-up animation pass — 20 November 2026

- The 3-step customer job-posting sheet now moves forward/backwards with a short directional reveal. Its progress strip fills smoothly and the selected timing radio dot settles into place. The modal, content width and scrollable options retain their original layout and actions.
- The tradesperson Home **Go online / Go offline** status label and button now crossfade when the actual confirmed availability value changes, not when the user merely taps the control. Database errors still prevent a false green/online confirmation.
- **Jobs → Offers / Active** now has a smoothly animated selection pill. Switching Urgent, Flexible, On My Way and Street Run options fades and lifts the new content without remounting the entire Jobs screen or replaying the animation for every backend refresh. The collapsible "How do I get jobs?" guide opens with a modest reveal.
- Selecting a customer map pin now animates the profile preview card up into its **existing anchored position**, complementing the pin camera motion; it does not wrap the absolutely positioned card in a container that would break the map layout.
- Animated tab/status content uses a layout-timed reset to avoid a one-frame flash during quick switching. A new app-state listener pauses repeated decorative motion when the app is backgrounded and restarts it on return.
- `scripts/test-motion-visuals.cjs` now checks the new motion flows, selection behaviour and foreground/background guards in CI.

## Manual visual sign-off still required on a real iPhone

1. From Customer: tap Home → Explore → Discover → Activity → Inbox quickly, then reverse the order. Confirm tab bar never jumps and the page content doesn't flicker or freeze.
2. Tap buttons of different shapes (round avatar, pill action, full-width card). Check only a slight squash and smooth release, no rubber bounce or rectangular flash.
3. Open Home on both account modes. Check the CTA and card entrances are visible and calm, **without changing the current card widths or clipping anything**.
4. Pan and zoom customer map from 11x to 17x with many grouped pins. Confirm pins expand into real traders and cluster animations do not overload the frame rate. Tap a trader; the selected pin must be clearly above its details card.
5. On merchant map, tap a shop pin and a horizontal bottom card. Confirm the selected pin stays visible and there is no misleading flying dot between you and the shop.
6. Open Inbox and switch Messages ↔ Activity rapidly. Confirm state, text input and scrolling remain stable.
7. In iPhone Settings → Accessibility → Motion, enable Reduce Motion while Tradarr is open. Animated elements should stop and all navigation/buttons still work.
8. Check a smaller iPhone viewport, dark/low-power mode and a slow network. Map and buttons must remain legible; never animate while loading indefinitely.

**No Expo update or App Store build was pushed to the user's iPhone.** These changes use built-in React Native Animated and CSS animation. An Expo Go reload should display JavaScript changes after pulling main, provided all existing dependencies are installed. The project still requires the usual native development build for push and in-app purchases.
