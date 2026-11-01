# VEDANT AI — Complete Super Platform Starter

**Learn · Create · Grow**

A mobile-first, responsive full-stack workspace for education, AI assistance, skill development and business operations.

## Included

- Responsive dashboard for mobile, tablet and desktop
- Supabase email/password authentication and user profiles
- Role-aware navigation (student, employee, manager, admin, owner)
- Gemini AI chat through a server-side API (API key never belongs in frontend code)
- PDF and image attachment support for Gemini (within provider/model limits)
- Learning Hub and course library
- Quiz and assessment database structure
- Create Studio with AI writing/planning shortcuts
- CRM leads with status pipeline
- HR team directory (admin-only data policy)
- Appointment scheduling records
- Analytics overview
- Admin console and role-aware access
- Supabase SQL schema, Row Level Security policies and private document bucket
- Installable PWA shell

## Important project status

This is a **full-stack starter with working core flows**, not a finished commercial SaaS product. Supabase authentication, Gemini chat, file-to-AI request, course listing/creation, lead management, appointment records, and role-protected data are wired. Some areas are foundation modules rather than complete products: video course player/progress UI, quiz authoring and scoring UI, employee invitation/attendance/payroll, calendar sync, payment/subscription billing, advanced analytics, voice input/output, email/SMS notifications, and audit logs still require implementation and provider configuration.

## Requirements

- Node.js 20+
- Supabase project
- Google AI Studio / Gemini API key
- GitHub account for repository hosting

## 1. Install

```bash
npm install
```

Copy `.env.example` to `.env` and fill in:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not put the Gemini key or Supabase service-role key in any `VITE_` variable. Never commit `.env`.

## 2. Configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run the complete `supabase/schema.sql`.
4. In Authentication settings, configure your site URL and email confirmation settings.
5. Create your account through the app.
6. In Supabase SQL Editor, promote your own profile to owner:

```sql
update public.profiles
set role = 'owner'
where id = 'YOUR_AUTH_USER_UUID';
```

Find your UUID under Authentication -> Users. Never promote users based only on an email supplied by an untrusted client.

The schema creates Row Level Security policies. Review these policies against your organization's exact access requirements before production use.

## 3. Run locally

```bash
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API server runs on port 3000.

For production build:

```bash
npm run build
npm start
```

Set `NODE_ENV=production` so Express serves the built frontend.

## 4. Deploy

Deploy to a Node.js host that supports persistent web services (Render, Railway, Fly.io, VPS, etc.).

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Set `NODE_ENV=production`
- Add the environment variables from `.env` in the host dashboard.
- Configure Supabase Auth allowed redirect/site URLs to your production domain.
- Configure HTTPS and a custom domain if needed.

## 5. Create GitHub repository

Create a new repository named `vedant-ai` under your GitHub account. Then from this folder:

```bash
git init
git add .
git commit -m "Build VEDANT AI super platform starter"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/vedant-ai.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with the exact username shown on your GitHub profile. This ZIP does not automatically create or push to GitHub.

## Security checklist before public launch

- Keep Gemini and service-role keys on the server only.
- Enable MFA for project owners and hosting/GitHub accounts.
- Review Supabase RLS policies with real student/employee/admin test accounts.
- Add server-side authorization for every privileged action.
- Add abuse monitoring, billing controls and AI usage limits.
- Add backups, retention policy, privacy policy and terms.
- Validate uploaded files and scan files if accepting public uploads.
- Do not use this starter as a payroll, legal, medical or financial system without domain review and stronger controls.

## Main structure

```text
vedant-ai/
├── public/
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── main.js
│   └── style.css
├── supabase/
│   └── schema.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── server.js
└── README.md
```
