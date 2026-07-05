-- 0013: Morning Brief delivery preferences.
--
-- brief_email_enabled — owner opted into the daily email brief (sent to the
--   account email; tier-checked server-side at dispatch: scheduled_brief).
-- whatsapp_number — E.164-ish number for WhatsApp delivery (Pro+ feature,
--   morning_brief gate at dispatch). Null = not opted in.
--
-- Dispatch is aibos-api POST /notify/dispatch-briefs (CRON_SECRET protected),
-- composing each brief from the user's real twin/events/products.

alter table public.profiles
  add column if not exists brief_email_enabled boolean not null default false,
  add column if not exists whatsapp_number text;
