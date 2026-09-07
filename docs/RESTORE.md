# Getting AI-BOS running again, on free tiers

Written 7 September 2026, after the subscriptions lapsed and both halves of the
system were switched off.

**Nothing in this file is a secret.** It names variables and says where to find
their values. This repository is public, so no key is ever written down here.

---

## What actually happened

Two separate things stopped, in two different ways, and it is worth telling them
apart because only one of them lost anything.

**The API is gone.** `aibos-api-production.up.railway.app` answers
`{"status":"error","code":404,"message":"Application not found"}`. The address
still exists; there is no longer an application behind it. Nothing was lost
here. The code is all in the `aibos-api` repository and can be put on a new host
in about ten minutes.

**The database is gone, and this is the serious one.** The hostname
`gfqrktybginabxwqlthu.supabase.co` no longer resolves at all — the name lookup
fails outright, which is different from a project that is merely paused. A
paused Supabase project still answers and tells you it is paused. One that does
not resolve has been removed.

If that is right, then everything that was in it went with it:

- every table's contents
- **every user account**, because logins live in Supabase's own `auth` schema

There is no backup of it anywhere in these repositories. Checked.

### Before anything else, if that data mattered

Supabase keeps deleted projects for a short window and their support team can
sometimes restore one. **That window is short and it is already running.** If
there was real customer data in there — Dunslim bookings, invoices, anyone's
business records — open a support ticket at supabase.com/dashboard/support
*today*, before creating anything new, and give them the project reference
`gfqrktybginabxwqlthu`.

If it was only your own test data, skip that and carry on below.

---

## The rebuild, in order

### 1. A new Supabase project (free)

Free tier: 500MB of database, two projects per organisation, no card. It goes to
sleep after a week with no traffic and wakes on one click from the dashboard.

1. supabase.com → New project. Pick the region nearest Lusaka.
2. Save the database password it gives you somewhere safe. You cannot see it
   again and you will want it eventually.

### 2. Put the schema back — one paste

The whole schema is in this repository, and it was checked before this file was
written: nothing had ever been created by hand in the dashboard, including the
`logos` storage bucket, which migration `0001` creates in SQL. So the migrations
really are all of it.

1. Open `supabase/REBUILD_ALL.sql` in this repository.
2. Supabase dashboard → SQL Editor → New query.
3. Paste the whole file. Run.

That is all twenty-six migrations in order, in one go. It is safe to run twice
if something interrupts it. If you would rather run them one at a time they are
in `supabase/migrations/`, but run them **in numbered order** — several build on
tables an earlier one creates.

Regenerate the combined file after adding any migration:

```bash
python scripts/build-db-rebuild.py
```

That script refuses to write the file if the migrations would not survive a
clean run, so it is also the check that this stays true.

### 3. Collect the four values the rest of the setup needs

Supabase dashboard → Project Settings:

| Where | What | Goes on to |
|---|---|---|
| API → Project URL | the `https://….supabase.co` address | both |
| API → `anon` `public` key | safe to expose in a browser | Vercel |
| API → `service_role` key | **bypasses all security rules** | both, server side only |
| API → JWT Settings → JWT Secret | lets the API check logins itself | the API host |

**The service_role key must never be given to a browser.** On Vercel it goes in
as `SUPABASE_SERVICE_ROLE_KEY`, with no `NEXT_PUBLIC_` in front of it. Anything
named `NEXT_PUBLIC_*` is shipped to every visitor.

There is previous form here: the API once ran with the anon key in the
`SUPABASE_SERVICE_KEY` slot, and every write silently failed the security rules.
It reads the *service_role* key. Check which one you copied.

### 4. Put the API somewhere free

Render has a free web service and does not ask for a card. `render.yaml` in the
`aibos-api` repository is set up for it.

1. render.com → New + → Blueprint → point it at the `aibos-api` repository.
2. It reads `render.yaml` and asks for the variables marked "sync: false".
3. Fill in at least these four, or it will run and do nothing useful:

   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` — the service_role key
   - `GROQ_API_KEY` — from console.groq.com, free
   - `ALLOWED_ORIGINS` — your Vercel address, comma separated, **no trailing
     slash**. Get this wrong and the site loads but every button fails, because
     the browser blocks the call before it leaves.

   Worth adding at the same time: `SUPABASE_JWT_SECRET`, `PUBLIC_APP_URL`, and
   `CRON_SECRET` (which must match the one on Vercel).

**What free costs you:** the service sleeps after 15 minutes of quiet, and the
next request waits 40–60 seconds while it wakes up. Everything after that is
normal speed. If that is not acceptable, point any uptime checker at `/health`
every 10 minutes — Render's free allowance is 750 hours a month against a
730-hour month, so one service kept awake around the clock still fits inside
free. A second one would not.

### 5. Point the front end at the new pieces

Vercel → the `aibos` project → Settings → Environment Variables. Update:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the new project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the new anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | the new service_role key |
| `NEXT_PUBLIC_API_URL` | the new Render address, no trailing slash |
| `ADMIN_EMAILS` | your email, comma separated |
| `CRON_SECRET` | any long random string, same as on the API |

Then **redeploy**. Vercel bakes `NEXT_PUBLIC_*` values into the build, so
changing them without a redeploy changes nothing at all — the old values stay
live and it looks like the change did not save.

---

## Checking it actually worked

Do these in order. Each one tells you something different, and stopping at the
first failure saves guessing.

**1. Is the API awake and can it see the database?**

```bash
curl https://YOUR-API.onrender.com/health
```

Expect `"status":"ok"` and, more importantly, `"supabase_configured": true`. If
that says `false`, the API cannot see the database: `SUPABASE_URL` or
`SUPABASE_SERVICE_KEY` is wrong or missing. `"host"` tells you which platform it
thinks it is on, and `"build_sha"` is the commit actually running — that is
there because a deploy failing while the previous version stays up has happened
before and looks identical to success.

**2. Does the schema exist?**

Supabase → Table Editor. You should see `profiles`, `business_events`,
`businesses`, `invoices`, `bookings` and about twenty more.

**3. Can a person sign up and get in?**

Open the site, create an account, reach the dashboard. Everyone has to sign up
again — the old accounts went with the old project. Your own account needs the
email listed in `ADMIN_EMAILS` before the admin panel will open.

**4. Does the front end reach the API?**

With the site open, F12 → Network, then do something that thinks. If you see a
CORS error, `ALLOWED_ORIGINS` on the API does not exactly match the address in
the browser bar. It is nearly always a trailing slash or `www` versus no `www`.

---

## What this does not restore

- **Data.** Every table comes back empty.
- **Accounts.** Everyone signs up again, including you.
- **Paid-tier records.** Anyone who had paid is back on free until their tier is
  set again. `profiles.tier` is the column.
- **Anything that was only ever in the dashboard.** Nothing was, as far as could
  be checked, but scheduled jobs and webhooks pointing at the old API address
  will need repointing.

## Keeping it from happening again

- **Supabase free projects pause after 7 days of no traffic.** Paused is
  recoverable in one click; that is not what happened here. Still, a weekly
  visit or an uptime check keeps it awake.
- **Take a backup.** Supabase → Database → Backups on paid plans; on free, run
  `pg_dump` against the connection string on a schedule. There was no backup of
  the last project, which is the whole reason this file exists.
- **`/health` is the deploy check.** Compare `build_sha` against the commit you
  pushed. Equal means the new code is live; different means the deploy failed
  and the old version is still serving.
