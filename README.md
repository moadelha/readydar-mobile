# DarClean Mobile

A React Native / Expo app for both sides of the DarClean marketplace — hosts and
cleaners — talking to the same DarClean backend (`apps/api`) as the web app. No
changes to the web app or backend were made to build this; it's a separate
client hitting the same REST API. One codebase, one app to install; the app
routes to a host or cleaner experience based on the account's role.

## What's built

### Cleaner side
- **Auth** — login, register, secure token storage (`expo-secure-store`),
  automatic silent refresh on 401 (mirrors the web app's fix)
- **Onboarding** — bio, years of experience, covered cities, weekly
  availability, profile picture + ID upload
- **Job Feed** — nearby jobs sorted by distance, pull-to-refresh, Accept
- **My Jobs** — all assigned jobs with status
- **Job Detail** — "Navigate" (opens Google/Apple Maps), GPS check-in via
  device location, start job, tap-to-toggle checklist, camera-based
  before/after photo capture, mark complete
- **Earnings** — this month / all-time totals, history list
- **Profile** — view profile, update GPS location, edit, log out

### Host side

Bottom tabs are now **Dashboard, Calendar, Properties, Bookings, More** —
Guests, Expenses, Cleaning contacts, Turnovers, and Profile moved under
**More** to keep the tab bar from getting cramped as features grew. Nothing
was removed, it's all one tap further in.

- **Auth** — same login/register flow; register now asks "I'm a host" vs.
  "I'm a cleaner" and routes accordingly (new hosts land on "Add your first
  property")
- **Dashboard** — property status at a glance (Ready / Needs cleaning / In
  progress / Guest staying), quick stats, a **quick-actions row** (Request
  cleaning / Log expense / Guest check-in — jump straight in without picking
  a property from a list first), "needs attention" list with one-tap
  "Request cleaning" / "Mark ready", upcoming bookings across all properties
- **Calendar** *(new)* — a combined agenda of cleanings and guest stays across
  every property, grouped by day, for the next 7 or 30 days. Tap an entry to
  jump to the booking or property behind it. Booking.com/Airbnb-synced stays
  are labelled by source when present
- **Properties** — list, add a property (type, city, address, bed/bath/guest
  counts, nightly rate, access instructions, wifi), property detail (access
  details, check-in/out times, house rules, door photos, request a cleaning
  from here)
- **Property automation settings** *(new)* — a gear icon on each property's
  detail page (and a button at the bottom) opens a settings screen to: turn
  the **guest welcome message** automation Off / Review-first / Automatic and
  edit its message **template** (with the same `{{variables}}` the backend
  supports), and separately turn **cleaning turnover alerts** Off /
  Review-first / Automatic, picking a default cleaning contact and default
  service. Both used to be web-only; both are now fully editable on mobile
- **Bookings** — list all bookings across every property, request a service
  (property + service picker sourced live from `/services`, date/time,
  urgency, special requests, budget), booking detail with the full lifecycle:
  confirm the matched cleaner, approve completed work (releases payment),
  cancel with a reason, raise a dispute, view the cleaner's checklist and
  before/after photos, and leave a star rating + review once completed
- **Guest online check-in** — from a property, generate a check-in link
  (dates, guest count, form language EN/FR/AR) and share it straight to
  WhatsApp; see every check-in for that property (pending / submitted /
  expired) with the guest's submitted phone, nationality, and ID info once
  they fill it in
- **Guests (under More) — WhatsApp welcome messages** — once a guest completes
  online check-in, their access-info welcome message (maps link, door photos,
  gate code, door code, house rules — built from the property's template)
  shows up here to review/edit and send via WhatsApp with one tap, or
  straight to "ready to send" if it's already been prepared. The exact same
  flow is also available inline on the property's own detail page, under that
  check-in — "Send welcome message" right there, no need to switch screens
- **Turnovers (under More)** *(new)* — the cleaning-side counterpart to
  guest welcome messages: after a guest checks out, notify your default
  cleaning contact via WhatsApp so they know a property needs turning around.
  "Needs your confirmation" for properties set to Review-first, "Ready to
  send" for ones already triggered. If a company-account contact is set as
  the default, confirming can also auto-book them for the job
- **Cleaning contacts (under More)** *(new)* — add/remove the people who get
  turnover alerts: your own staff ("External"), or an enrolled DarClean
  cleaning company account (by their account email). Each property picks its
  own default contact in its automation settings
- **Expenses (under More)** — log bills/supplies/maintenance costs against a
  property (or "General"), filter by property and this-month/all-time,
  running total, delete manually-logged entries. Expenses auto-created when
  you approve a completed cleaning booking show up here too, tagged
  "Auto-added" — the backend won't let those be deleted directly (cancel the
  booking instead). Note: the expenses API requires Manager-level host
  access — a Staff-role team member will get a clean "forbidden" error, same
  as on web
- **Profile (under More)** — name, email, phone (editable), host team role
  badge (Owner/Manager/Staff), shortcuts to Cleaning contacts and Turnovers,
  log out
- **Property picker that scales** — anywhere you pick a property (Expenses,
  Log an expense, Request a service, Guest online check-in), it's a compact
  chip row for a handful of properties, but automatically switches to a
  tappable field that opens a searchable list once you have more than 6 —
  so it stays usable whether you manage 3 properties or 30
- **Consistent error + empty states** — list screens that fetch data
  (Dashboard, Properties, Bookings, Expenses, Guests, Turnovers, Cleaning
  contacts, Calendar, property detail, profile) now show a dismissible error
  banner with a **Retry** button on failure instead of a dead-end message,
  and empty states carry a direct action (e.g. "Add your first property")
  rather than just descriptive text

## What's NOT built yet in the host mobile experience

These stay on the web dashboard for now — the same honest-gaps approach as
the original cleaner-only scope:

- **iCal sync** (Airbnb/Booking.com calendar import/export URLs) — the
  Calendar screen will display synced reservations once they exist, but
  connecting the iCal feeds themselves is still web-only
- **General property photos** (beyond door/access photos, which mobile
  already uploads) and re-editing access-instructions/wifi text after
  creation — creation-time only on mobile right now
- **Host team management** — inviting managers/staff, revoking access
- **Billing & subscriptions** — plan selection, payment history
- **Reports & analytics** (revenue, occupancy, ADR, RevPAR, profit estimates)
  — expense *logging* is on mobile now, but the rolled-up analytics that
  combine it with booking revenue stay on web
- **Tomorrow's-checkout cleaning reminders** — the backend supports a
  separate reminder nudge (as distinct from the turnover alert itself); not
  wired up on mobile yet

## Other known gaps (both sides)

- **Push notifications** — needs a Firebase/Expo push project you create and
  own; I can wire the code once you have credentials, but can't create the
  account myself
- **App icon / splash image** — `app.json` currently has no icon/splash image
  reference (removed to avoid a broken `expo start` without placeholder
  assets) — drop a 1024×1024 PNG at `assets/icon.png` and re-add the
  reference when you have real branding art
- **Store submission** — building an installable `.apk`/`.aab` via
  [EAS Build](https://docs.expo.dev/build/introduction/) and submitting to
  Play Store both require your own Expo/Google developer accounts

## One-time cleanup after this update

Guests, Expenses, and Profile moved from `app/(host-tabs)/` to `app/host/`
(see Project structure below) so they could come off the tab bar. The old
files at their previous location would still work as *extra, unwanted* tabs
if left in place, so they've been moved into a `_to_delete/` folder at the
project root instead of edited in place — expo-router only auto-registers
routes from inside `app/`, so this alone stops the ghost tabs. Once you've
confirmed the app runs fine, delete that `_to_delete/` folder — it's not
referenced by anything.

## Prerequisites

- Node.js 20+
- The DarClean API running (`apps/api` from the main project) and reachable
  from your phone/emulator
- [Expo Go](https://expo.dev/go) installed on your Android phone (from Play
  Store) — this is the fastest way to test without any native build step

## Setup

```bash
cd darclean-mobile
npm install
cp .env.example .env
```

### Point it at your API

Edit `.env` — for a physical device or emulator, `localhost` will **not**
work, since the phone isn't "localhost" relative to your computer. Use your
computer's LAN IP instead:

- **Windows**: `ipconfig` → look for "IPv4 Address" (something like
  `192.168.1.42`)
- **Mac**: `ipconfig getifaddr en0`

```
EXPO_PUBLIC_API_URL=http://192.168.1.42:4000/api/v1
EXPO_PUBLIC_WEB_URL=http://192.168.1.42:3000
```

`EXPO_PUBLIC_WEB_URL` should point at your running `apps/web` (same LAN-IP
rule) — it's only used to build the guest-facing online check-in link
(`{webUrl}/checkin/{token}`) that gets shared via WhatsApp. If you skip it,
it falls back to `http://localhost:3000`, which won't be reachable from a
guest's phone.

Your phone and computer need to be on the **same Wi-Fi network**, and the API
server needs to actually be running and reachable at that address — if you
see "Network request failed" errors on startup, that's almost always the
API not running, a stale IP in `.env`, or a firewall prompt you need to
allow (Windows will ask the first time you start the API server; say yes).
Also make sure your API's CORS config (`CORS_ORIGIN` in `apps/api/.env`)
doesn't block this — the current setup allows all origins for the mobile
client's plain `fetch` calls (no browser CORS enforcement applies to native
apps), so this should just work without changes.

For actual WhatsApp delivery without the host tapping a wa.me link, the API
needs `WHATSAPP_BUSINESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` set (Meta
WhatsApp Cloud API) — otherwise (the default) every "send" opens WhatsApp
with the message pre-filled for a one-tap manual send, which is what the
mobile app is built to handle either way.

### Run it

```bash
npm start
```

This opens the Expo dev tools. Scan the QR code with the **Expo Go** app on
your Android phone (or press `a` to launch an Android emulator if you have
Android Studio set up). The app loads live on your device — edit any file and
it hot-reloads.

## Testing the full flow

Use your existing seeded accounts (or register a fresh Host account from the
app — tap "I'm a host" on the sign-up screen):
```
cleaner@example.com / Password123!
```

**As a host:**
1. Log in with a host account (or register a new one — you'll land on "Add a
   property")
2. Add a property if you haven't got one
3. From the Dashboard's quick actions, or a property's detail screen, tap
   "Request cleaning" — pick a service, date/time, urgency
4. As a cleaner (on this app, a different account, or the web app), accept
   the job and work through Check in → Start → Complete
5. Back on the host side, open the booking — tap "Confirm cleaner" once
   matched, and "Approve & release payment" once the cleaner marks it
   complete
6. Leave a star rating; check the property's status flips back to "Ready",
   and the cleaning shows up on the **Calendar** tab

**Guest online check-in + WhatsApp welcome message:**
1. Open a property → "Guest check-ins" → tap **+**
2. Set the expected check-in/out dates and tap "Create check-in link" →
   "Share via WhatsApp" sends the guest the online check-in form link
3. Have the guest (or you, for testing) open that link and submit the form
   — it's the public `apps/web` route `/checkin/[token]`, no login needed
4. Back in the app, the check-in now shows as "Submitted" on the property
   page. What happens next depends on that property's automation settings
   (tap the gear icon on the property page): **Off** — nothing sent
   automatically; **Review-first** — appears under Guests (More → Guests)
   and inline on the property page for you to review/edit and send;
   **Automatic** — sent right away, no action needed
5. If it's waiting on you, send it from wherever's convenient — tap it under
   More → Guests, or tap "Send welcome message" right on the property's
   detail screen under that check-in. Either way, same preview/edit box,
   then "Send via WhatsApp" — opens WhatsApp with the message pre-filled
   unless the API has WhatsApp Cloud API credentials configured, in which
   case it's sent automatically

**Cleaning turnover alerts:**
1. More → Cleaning contacts → add a contact (name, WhatsApp number, and
   whether they're your own staff or an enrolled DarClean company account)
2. Open a property → gear icon (Automation settings) → set "Cleaning turnover
   alerts" to Review-first or Automatic, and pick that contact as the
   default
3. After a guest checks out (or submits check-in, depending on your setup),
   it appears under More → Turnovers → "Needs your confirmation" — tap
   "Confirm & notify cleaner" to send them a WhatsApp with the checkout date
   and access details

**Calendar:**
1. Open the Calendar tab — toggle "Next 7 days" / "Next 30 days"
2. Tap any entry to jump straight to the booking or property behind it

**Expenses:**
1. From More → Expenses (or a property's "Log an expense for this property"
   button, or the Dashboard quick action), tap **+**
2. Pick a category, amount, date, and optionally a property → "Log expense"
   (the property picker is a chip row normally, but flips to a searchable
   list automatically if you have more than 6 properties)
3. It shows up in the list immediately with the running total updated;
   filter by property or switch This month / All time to see more

**As a cleaner:**
1. Log in
2. Pull-to-refresh the Job Feed tab — the host's request appears
3. Accept it → you're taken to the job detail screen
4. Walk through Check in → Start → tick checklist items → take before/after
   photos → Complete
5. Once the host approves, check the Earnings tab on the phone

## Project structure

```
darclean-mobile/
├── app/                        # expo-router file-based routes
│   ├── _layout.tsx              # root layout, wraps AuthProvider
│   ├── index.tsx                # redirects based on auth state + role
│   ├── login.tsx
│   ├── register.tsx             # role picker: host vs. cleaner
│   ├── onboarding.tsx           # cleaner onboarding
│   ├── (tabs)/                   # cleaner bottom tab navigator
│   │   ├── feed.tsx
│   │   ├── jobs.tsx
│   │   ├── earnings.tsx
│   │   └── profile.tsx
│   ├── job/[id].tsx              # cleaner job detail (outside tabs)
│   ├── (host-tabs)/               # host bottom tab navigator (5 tabs)
│   │   ├── dashboard.tsx
│   │   ├── calendar.tsx           # combined cleaning/guest-stay agenda
│   │   ├── properties.tsx
│   │   ├── bookings.tsx
│   │   └── more.tsx               # hub: Guests, Expenses, Turnovers, Contacts, Profile
│   └── host/
│       ├── property/[id].tsx      # property detail (incl. guest check-ins list)
│       ├── property/new.tsx       # add property
│       ├── property-settings/[id].tsx  # automation mode + welcome template + turnover contact
│       ├── booking/[id].tsx       # booking detail (confirm/approve/cancel/dispute/review)
│       ├── booking/new.tsx        # request a service
│       ├── checkin/new.tsx        # generate + share a guest online check-in link
│       ├── expense/new.tsx        # log an expense
│       ├── expenses.tsx           # expense list, filters, running total (was a tab)
│       ├── guests.tsx             # guest WhatsApp welcome-message queue (was a tab)
│       ├── profile.tsx            # host profile (was a tab)
│       ├── turnovers.tsx          # cleaning-contact turnover WhatsApp alerts
│       ├── cleaning-contacts.tsx  # list/remove cleaning contacts
│       └── cleaning-contact/new.tsx  # add a cleaning contact
├── src/
│   ├── lib/
│   │   ├── api.ts                 # API client — same endpoints as the web app
│   │   ├── auth-context.tsx       # session state + secure storage + role routing
│   │   └── status.ts              # shared status label/color helpers
│   ├── components/                # Button, Card, TextField, SegmentedControl, Chip,
│   │                                ErrorBanner, PropertySelect (chips ↔ searchable modal), etc.
│   └── theme.ts                    # design tokens matching the web app's brand
├── app.json                        # Expo config (permissions, bundle IDs)
├── _to_delete/                     # orphaned old tab files — safe to delete, see above
└── .env.example
```

## Design

Colors and typography intentionally match `apps/web`'s Tailwind config
(`primary` teal `#006D77`, `accent` amber `#FFB703`, warm sand background)
so this feels like the same product, not a bolted-on separate app.
