# AI-BOS — Section 1: Auth Setup Guide

## What's Been Built

```
✅ /app/login/page.tsx          → Immersive login page (Google OAuth)
✅ /app/auth/callback/route.ts  → OAuth callback handler + profile upsert
✅ /app/layout.tsx              → Root layout (fonts, metadata)
✅ /lib/supabase.ts             → Browser + Server + Middleware clients
✅ /middleware.ts               → Route protection (session check)
✅ /hooks/useAuth.ts            → Session state hook
✅ /styles/globals.css          → Full design system (variables, animations)
✅ /tailwind.config.ts          → Extended design tokens
✅ package.json / tsconfig / next.config.js
```

---

## Setup Steps

### 1. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 2. Configure Environment
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key
```

### 3. Configure Supabase Google OAuth

In **Supabase Dashboard → Authentication → Providers → Google**:
- Enable Google
- Add Client ID + Secret from Google Cloud Console
- Add Authorized Redirect URLs:
  - `http://localhost:3000/auth/callback` (dev)
  - `https://your-app.vercel.app/auth/callback` (prod)

In **Supabase Dashboard → Authentication → URL Configuration**:
- Site URL: `https://your-app.vercel.app`
- Additional Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://your-app.vercel.app/auth/callback`

### 4. Run Dev Server
```bash
npm run dev
```

Visit `http://localhost:3000` → redirects to `/login`.

---

## Auth Flow (exactly as spec requires)

```
User visits /            → middleware redirects to /login
User clicks Google       → supabase.auth.signInWithOAuth()
Google OAuth completes   → redirects to /auth/callback?code=...
/auth/callback           → exchangeCodeForSession() → upserts profile
                         → redirects to /dashboard
```

---

## Design Features on Login Page

| Feature | Implementation |
|---------|---------------|
| Animated mesh bg | CSS keyframe animation (meshFloat, 20s) |
| Floating particles | 18 CSS-animated divs, random positions |
| Grid overlay | CSS background-image grid pattern |
| Glass card | backdrop-filter blur(20px), rgba bg |
| Logo animation | Framer Motion spring scale + rotate |
| Tagline animation | letter-spacing animated 0.5em → 0.18em |
| Card entrance | framer fade up from y:32, scale:0.97 |
| Error shake | CSS keyframe shakeAnim |
| Error state | Red border + StatusBadge component |
| Loading state | Custom branded spinner (not browser default) |
| Redirecting state | Animated dots loading indicator |
| Keyboard shortcut | Enter key triggers Google sign-in |
| Google button | White, hover lift, custom Google SVG icon |
| Footer | DM Mono font, terms + privacy links |

---

## Next Section

Once auth is confirmed working, proceed to:
**Section 2: Dashboard Layout** — Sidebar + TopNav + main content shell
```
