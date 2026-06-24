# medsa — Universal Health Passport Platform

> Built with Next.js · Designed for Hong Kong, built for the world

---

## What this project is

Medsa is three apps in one codebase:

| Portal | Who uses it | URL |
|---|---|---|
| **Patient portal** | Patients, families, guardians | medsa.health/patient |
| **Practitioner portal** | All healthcare staff | medsa.health/practitioner |
| **Institution & partner portal** | Hospital admins, insurance companies | medsa.health/institution |

---

## Folder structure — what every file does

```
medsa/
│
├── package.json              ← Tells Node.js what this project is + what to install
├── next.config.js            ← Next.js settings (you rarely touch this)
│
├── styles/
│   └── globals.css           ← App-wide styles: fonts, colour variables, reset
│
├── pages/                    ← Every file here becomes a URL on your site
│   ├── _app.jsx              ← Root wrapper — loads global CSS, wraps all pages
│   ├── index.jsx             ← medsa.health/ — landing page, portal selector
│   ├── patient.jsx           ← medsa.health/patient — patient portal
│   ├── practitioner.jsx      ← medsa.health/practitioner — practitioner portal
│   ├── institution.jsx       ← medsa.health/institution — institution + insurance
│   └── claim-review.jsx      ← medsa.health/claim-review — agent claim review link
│
├── components/
│   │
│   ├── shared/               ← Used by ALL three portals
│   │   ├── MedsaLogo.jsx     ← The medsa wordmark SVG (custom, all lowercase)
│   │   ├── UI.jsx            ← Reusable building blocks: Btn, Card, Toggle, Modal
│   │   └── colours.js        ← Single source of truth for every colour in the app
│   │
│   ├── patient/              ← PATIENT PORTAL screens
│   │   ├── PatientApp.jsx    ← Root — manages screen routing, topbar, bottom nav
│   │   ├── EmergencyOverlay  ← SOS card — always accessible, shows critical info
│   │   ├── HomeScreen        ← Dashboard: QR passport, quick tiles, message board
│   │   ├── RecordsScreen     ← Medical records, vaccinations, sharing, upload
│   │   ├── DoctorsScreen     ← Find doctors/clinics, wait times, book, pay
│   │   ├── CalendarScreen    ← Appointments, medication alarms with time picker
│   │   ├── InsuranceScreen   ← AI plan browser, claims, agent contact
│   │   ├── PrescriptionsScreen ← Active meds, drug info, refill, interaction check
│   │   ├── FamilyScreen      ← Guardian controls for minors/seniors/disability
│   │   └── StorageScreen     ← Subscription tiers: Free / Personal / Family
│   │
│   ├── practitioner/         ← PRACTITIONER PORTAL screens
│   │   ├── PractitionerApp.jsx ← Root — manages clock-in state, screen routing
│   │   ├── roles.js          ← Role definitions + default access permissions
│   │   ├── ClockInScreen     ← QR scan to clock in — unlocks patient data
│   │   ├── PractitionerIDScreen ← ID card, license, scan permissions
│   │   ├── PatientSearchScreen ← Scan QR or search; tiered access by role
│   │   │                         EMS → emergency card immediately
│   │   │                         Others → tabbed patient view (only what role allows)
│   │   ├── ScheduleScreen    ← Personal shifts + LIVE HOSPITAL OVERVIEW (all roles)
│   │   │                         Dept schedule + shift requests (heads/admin only)
│   │   ├── MessagesScreen    ← Internal messaging with compose
│   │   ├── AdminPermissions  ← Role permission manager (admin only)
│   │   └── HelpScreen        ← Support, complaints, FAQ, privacy
│   │
│   ├── institution/          ← INSTITUTION PORTAL screens (medical admin)
│   │   ├── InstitutionApp.jsx ← Root — portal selector (institution vs insurance)
│   │   ├── InstitutionDashboard ← Live overview: beds, staff, discharges, wait times
│   │   ├── PractitionerList  ← All staff, searchable, by department, credentials
│   │   ├── PatientList       ← All patients, admission reason visible on card
│   │   │                         Unregistered flagged — syncs on Medsa registration
│   │   ├── FullSchedule      ← By department / by tier / patient appointment schedule
│   │   ├── OccupancyScreen   ← Beds, busy rate, wait times per department (bar chart)
│   │   └── PortalManagement  ← Create/cancel portals, approve new credentials
│   │
│   └── insurance/            ← INSURANCE PARTNER PORTAL screens
│       ├── InsuranceDashboard ← Overview: plan views, new clients, pending claims
│       ├── PlanManager       ← Add/edit plan listings (like a restaurant menu)
│       ├── InsuranceAdminClaimsLog ← Full claims log with agent decisions + reasons
│       │                         Admin views only — cannot approve/reject directly
│       │                         Can override or send reminder to agent
│       ├── SponsoredListings ← Buy sponsored placements in AI recommendations
│       └── AgentClaimView    ← Standalone claim review for agents (opened via link)
│                                 No login needed — secured by one-time URL token
```

---

## How to fill in the placeholder screens

Every screen file currently shows a grey placeholder. To make it real:

1. Open the matching source file from your `outputs` folder:
   - Patient screens → `medsa-complete.jsx` + `medsa-patient-updates.jsx`
   - Practitioner screens → `medsa-practitioner-v2.jsx` + `medsa-updates-v3.jsx`
   - Institution screens → `medsa-institution-portal.jsx`
   - Insurance screens → `medsa-institution-portal.jsx` + `medsa-updates-v3.jsx`

2. Find the matching function (e.g. `function RecordsScreen`)
3. Copy the entire function body into the component file
4. Make sure you import `C from '../shared/colours'` at the top
5. Replace the `export default function X()` placeholder

---

## How to run locally (on your computer)

You need Node.js installed first. Download it at nodejs.org (LTS version).

Then in Terminal (Mac) or Command Prompt (Windows):

```bash
# 1. Go into the project folder
cd medsa

# 2. Install everything the project needs (only needed once)
npm install

# 3. Start the app
npm run dev

# 4. Open your browser and go to:
# http://localhost:3000
```

Every time you save a file, the browser updates automatically.

---

## How to deploy to Vercel (make it live at medsa.health)

You only need to do this once. After that, every time you push to GitHub it
deploys automatically.

### Step 1 — Push this folder to GitHub
1. Open GitHub Desktop
2. Add this `medsa` folder as a new repository
3. Commit all files with message "initial project structure"
4. Push to GitHub

### Step 2 — Connect to Vercel
1. Go to vercel.com → Add New → Project
2. Import your `medsa-health` GitHub repository
3. Framework preset: **Next.js** (Vercel detects this automatically)
4. Click **Deploy**

### Step 3 — Add your domain
1. In Vercel → your project → Settings → Domains
2. Add `medsa.health`
3. Copy the DNS records Vercel gives you
4. Paste them into your domain registrar's DNS settings
5. Wait 10–30 minutes → live at medsa.health

---

## The three revenue streams (built into the product)

| Stream | How |
|---|---|
| **B2B institution subscription** | Hospitals/clinics pay monthly for practitioner + admin portal access |
| **Patient storage tiers** | Free (2GB) → Personal HK$18/mo → Family HK$38/mo |
| **Insurance marketplace** | Listing fee + sponsored placement fee + referral commission per new client |

---

## Tech stack

| What | Tool | Why |
|---|---|---|
| Framework | Next.js 14 | Pages become URLs automatically, deploys perfectly on Vercel |
| Database (next step) | Supabase | Patient records, auth, real-time sync |
| Hosting | Vercel | Auto-deploys from GitHub, free tier available |
| Security | Cloudflare | DNS, DDoS protection, HTTPS |
| Auth (next step) | Supabase Auth | Patient login, practitioner clock-in, institution admin |

---

## Next steps after deployment

Once the prototype is live:

1. **Set up Supabase** — create your database tables for patients, records, practitioners
2. **Add authentication** — real login for patients, QR clock-in for practitioners
3. **Connect real data** — replace the dummy patient/doctor data with live database queries
4. **Apply to Cyberport / HKSTP** — use the live prototype as your demo
5. **Trademark filing** — file Medsa in HK (Classes 42 and 44) at ipd.gov.hk

---

*medsa.health · Built by Victoria · v1.0 prototype*
