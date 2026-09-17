# Re-publishing ReadyDar to Expo / EAS from scratch

Run everything from `C:\Users\elhan\darclean-mobile\darclean-mobile`.

I've already edited `app.json` for you: the dead `updates.url` and the dead
`extra.eas.projectId` are gone (they pointed at the project you deleted), and
the new icons are in `assets/`. The commands below fill the two removed values
back in with the new project's ones.

---

## Before you start — the DNS problem

Three of your last builds died on `ENOTFOUND` (`storage.googleapis.com`,
`api.expo.dev`, `wf-artifacts.eascdn.net`). None of those were code problems.
Clear it first or you'll lose another hour:

```powershell
ipconfig /flushdns
nslookup api.expo.dev
```

If `nslookup` fails, set your adapter's DNS to `1.1.1.1` / `8.8.8.8` and turn
off any VPN or antivirus web-shield for the duration of the build.

---

## 1. Log in

```powershell
npx eas-cli@latest login
npx eas-cli@latest whoami
```

## 2. Create the new EAS project

```powershell
npx eas-cli@latest init
```

It'll ask to create `@<your-account>/darclean-mobile` — say yes. It writes a
**new** `extra.eas.projectId` into `app.json`.

> If it complains the slug is still taken by the deleted project, change
> `"slug": "darclean-mobile"` to `"slug": "readydar"` in `app.json` and run
> `init` again. The slug is only EAS's name for the project — it doesn't
> affect the installed app.

## 3. Re-link Updates

```powershell
npx eas-cli@latest update:configure
```

This writes the new `updates.url` (`https://u.expo.dev/<new-project-id>`) and
confirms `runtimeVersion: appVersion`. **Don't skip it** — without it
`eas update` has nowhere to publish and the app has nowhere to check.

`eas.json` needs no changes: the `development` / `preview` / `production`
channels are already declared there.

## 4. Re-create the environment variables

These lived on Expo's servers, so they died with the project. `eas.json` has
them inline for **builds**, but `eas update --environment preview` reads them
from EAS — miss this and your OTA bundles ship with no API URL and the app
can't reach the backend.

```powershell
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value "https://darclean-api.onrender.com/api/v1" --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_WEB_URL --value "https://readydar.com" --visibility plaintext

npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value "https://darclean-api.onrender.com/api/v1" --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_WEB_URL --value "https://readydar.com" --visibility plaintext
```

Check them:

```powershell
npx eas-cli@latest env:list --environment preview
```

## 5. Build

```powershell
npx eas-cli@latest build --platform android --profile preview
```

It will offer to **generate a new Android keystore** — accept. This build is
also what puts the new icon on the phone (see the warning below).

`versionCode` is `21` in `app.json` with `autoIncrement` on, so this build goes
out as `22`. That's fine — nothing resets.

## 6. Install

**You have to uninstall the old ReadyDar first.** See the warning below.

## 7. Back to normal — OTA updates

Once that build is installed, JS-only changes ship the usual way:

```powershell
npx eas-cli@latest update --channel preview --platform android --environment preview --message "..."
```

`--platform android` is still mandatory (this project has no
`react-native-web`, and without the flag the CLI tries to bundle for web and
fails).

---

## Two things that will bite you if you don't know them

### The new APK will not install over the old one

A new EAS project means a **new signing keystore**, and Android refuses to
install an APK signed with a different key over an existing one
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). You and anyone testing must
**uninstall ReadyDar first**, which means logging in again — the stored session
goes with it. I checked the repo and there's no local `.jks` backup, so the old
key is gone with the project; if you ever exported it to Expo's dashboard
downloads or saved it elsewhere, you could upload it during step 5 instead and
skip the uninstall.

Every currently installed copy also loses its update channel, so nothing
already on a phone will ever pull another OTA. They all need the new APK.

### The icon only lands via a build

App icons are native config. `eas update` cannot change them — it only ships
JS. The new icon appears when the step-5 build is installed, not before.

---

## What changed in `app.json`

| | before | after |
|---|---|---|
| `updates.url` | pointed at the deleted project | removed — step 3 rewrites it |
| `extra.eas.projectId` | `c7c2d2d4-…` (deleted) | removed — step 2 rewrites it |
| `android.adaptiveIcon.backgroundColor` | `#006D77` (old teal) | `#FFFFFF` |

Everything else is untouched — `com.darclean.mobile` stays the package name, so
the app keeps its identity, and `runtimeVersion` stays on the `appVersion`
policy.

## New icon files

| file | size | notes |
|---|---|---|
| `assets/icon.png` | 1024×1024, **no alpha** | white background, mark at 74% — iOS rejects icons with transparency |
| `assets/adaptive-icon.png` | 1024×1024, transparent | mark at 48% so nothing clips under Android's circle mask |
| `assets/splash-icon.png` | 512×512, transparent | shown at 200pt on the `#FBFAF7` splash |
| `readydar-logo.svg` | vector | the master — kept at the repo root so it isn't bundled into the app |

These were traced to vector from your PNG rather than upscaled, so the curves
are clean at 1024px instead of soft.
