# Tradarr iOS preview delivery · quota-aware release

Date: 21 November 2026. Expo GitHub integration reported: **Free plan CI/CD and Simulator 60-minute limit reached** on the latest main commit. Further preview workflow jobs cannot start until the account's allowance resets or its plan changes. This is separate from the **passing GitHub TypeScript, Expo package, map and logic checks**.

## Change
- Auto-running the paid/minute-consuming Expo workflow on **every GitHub main merge** was exhausting the allowance without checking the app on a real device.
- The workflow remains present with the same fingerprint → compatible build detection → native build or OTA update flow, but its trigger is now manual: `workflow_dispatch`.
- This **deliberately disables automatic preview delivery**. Merging code does **not** update the user's installed iPhone app. No EAS build, OTA update or App Store submission was created by this change.

## Run after code review and quota/credentials are available
1. On a computer with repository access, pull updated `main` and install Node dependencies: `npm install`.
2. Log into the Expo project owner account via `eas login`; check `eas whoami` and the Expo dashboard for remaining quota.
3. Confirm native credentials, Apple's development membership/device provisioning if an iOS native build is required, and project fingerprint.
4. Validate the definition with `eas workflow:validate .eas/workflows/publish-preview-update.yml`.
5. Trigger a **single deliberate** release with `eas workflow:run .eas/workflows/publish-preview-update.yml`. Optionally identify the current Git branch and commit as documented in Expo Workflows.
6. Check actual workflow results and install the new build if native dependencies changed; only compatible JS changes can be delivered as OTA updates.
7. On physical iPhone, test signup, reduced-motion transitions, inbox, customer/trader roles, maps, booking and notifications before inviting pilot users.
8. Do not claim a successful deployment on iPhone until the exact update/channel is confirmed.

## Source
- https://docs.expo.dev/eas/workflows/syntax/
- https://docs.expo.dev/eas/workflows/manage-workflow-runs/
- https://docs.expo.dev/eas/workflows/troubleshooting/
