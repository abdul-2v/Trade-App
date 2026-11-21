# Native account completion pass — 21 November 2026

## Delivered in app source
- Retained established Expo/EAS project and iOS/Android app identifiers; changing them would require deliberate native store/app identity migration.
- Corrected legacy TradeHub name in password recovery.
- Treat the signup mobile number as private. Do not insert artificial digits while the user is typing; whole-number international formats +44, 0044 and UK 07 normalise at submission.
- Reduced invalid phone acceptance and allowed longer pasted international formats.
- Added relevant length bounds for form fields and a truthful pilot/availability confirmation, without pretending legally final Terms and Privacy have been published.
- Adopted distinct headline and interface font choices on key inbox, route, business tools, Pro and support screens. Existing premium touch animation and reduced-motion support retained.
- Set button semantics on MotionPressable while allowing caller-provided accessibility roles such as checkbox.
- Changed error boundary copy so it does not claim unsaved drafts are already on the server.
- Added CI regression test checking actual pure UK mobile parser, brand wording and form behaviour.

## Critical external acceptance
- [ ] True registration on iOS/Android with confirmed email and real custom SMTP.
- [ ] Verify 07, +44, 0044 entry/paste, backspacing and failed network recovery.
- [ ] Confirm app store deep-link and password recovery flows.
- [ ] Review and publish actual privacy/terms content before unrestricted production signups; pilot checkbox is not final legal acceptance.
- [ ] Install a signed development build to test remote push and native purchases; Expo Go does not complete them.
- [ ] Run account switch, blocked user, safety case and deletion request on two independent devices.
- [ ] Visually check revised fonts, keyboard visibility, labels and timing on a real iPhone.
- [ ] Do not change com.tradehub.app bundle identifiers without store ownership/registration plan.


## Cloud preview delivery status

The EAS preview workflow was changed to manual to stop automatic main-push executions consuming Expo's free monthly CI/CD minutes. Existing GitHub code/test CI remains automatic. See docs/IOS_PREVIEW_RELEASE_RUNBOOK_2026-11-21.md for commands and current quota gate. No new native build or OTA update is claimed.
