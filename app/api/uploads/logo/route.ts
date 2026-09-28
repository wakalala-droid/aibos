/**
 * POST /api/uploads/logo — put a logo in the public `logos` bucket.
 *
 * WHY THIS EXISTS. The browser used to upload straight into Supabase Storage.
 * That write is governed by a policy on `storage.objects` created in migration
 * 0001, and when that policy is missing from the live project — as it is on any
 * database restored without the storage section, which is easy to skip because
 * the SQL editor can refuse it — every upload comes back as
 *
 *     new row violates row-level security policy
 *
 * which is what the owner sees while only trying to add their logo. The same
 * wall already blocked the profile self-update, and the answer there was to
 * write through the server (see app/api/profile/route.ts). This route is that
 * answer for files, so a logo uploads on a fresh database with no SQL to run
 * first.
 *
 * The caller is resolved from their own session, and the file is always written
 * inside `<user-id>/`, so this route grants nothing the old policy did not: a
 * signed-in person may only write into their own folder. The service key does
 * the storage write, it never decides whose folder that is.
 *
 * Body: multipart/form-data
 *   file    — the image (PNG, JPG, WEBP or GIF; 2 MB max)
 *   attach  — 'profile' (default) writes the URL to the caller's profile;
 *             'none' just returns the URL for the caller to save elsewhere
 *   label   — optional filename stem, e.g. 'property-12-email'. Uploading the
 *             same label again replaces the earlier file instead of piling up.
 *
 * Returns { url } (plus { profile } when attach=profile).
 */

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'logos';

// A logo is a small image. The host in front of this route rejects bodies over
// about 4.5 MB before the code ever runs, so the limit sits well under that:
// the owner gets this sentence instead of a dead request.
const MAX_BYTES = 2 * 1024 * 1024;

// SVG is deliberately absent: it can carry script, and these files are served
// from a public bucket. The four below cover every logo a customer has.
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: Request) {
  const session = await createServerComponentClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Please sign in again, then upload the logo.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'The logo did not arrive. Please try again.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Please choose an image file for the logo.' }, { status: 400 });
  }

  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Use a PNG, JPG, WEBP or GIF image. Other kinds do not show up everywhere your logo appears.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return NextResponse.json(
      {
        error: `That image is ${mb} MB. Please use one under 2 MB — a logo that size loads slowly for everyone who sees it.`,
      },
      { status: 413 }
    );
  }

  const label = slug(form.get('label')) || 'logo';
  const attach = form.get('attach') === 'none' ? 'none' : 'profile';
  const path = `${user.id}/${label}-${Date.now()}.${ext}`;

  const svc = createServiceClient();

  const bucketError = await ensureBucket(svc);
  if (bucketError) return NextResponse.json({ error: bucketError }, { status: 500 });

  const body = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from(BUCKET)
    .upload(path, body, { contentType: file.type, cacheControl: '3600', upsert: true });

  if (upErr) {
    console.error('[api/uploads/logo] upload failed:', upErr.message);
    return NextResponse.json({ error: `The logo could not be saved: ${upErr.message}` }, { status: 500 });
  }

  const url = svc.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // The earlier file under this label is now unreachable — remove it so an
  // owner who changes their logo a dozen times is not storing a dozen copies.
  await sweep(svc, user.id, label, path);

  if (attach === 'none') return NextResponse.json({ url });

  const { data: profile, error: saveErr } = await svc
    .from('profiles')
    .update({ logo_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('*')
    .maybeSingle();

  if (saveErr) {
    console.error('[api/uploads/logo] profile update failed:', saveErr.message);
    // The image itself is safely uploaded; only the link back to it failed.
    // Hand the URL back anyway so the page can show it and the owner can save.
    return NextResponse.json({ url, error: saveErr.message }, { status: 500 });
  }

  return NextResponse.json({ url, profile });
}

/**
 * The bucket is created by migration 0001, but a database restored without that
 * section has none — and a bucket that exists yet is private serves no public
 * URL, so the logo would upload and then render as a broken image. Both are
 * settled here once, with the service key, rather than asked of the owner.
 */
async function ensureBucket(svc: ReturnType<typeof createServiceClient>): Promise<string | null> {
  const { data: bucket } = await svc.storage.getBucket(BUCKET);

  if (!bucket) {
    const { error } = await svc.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: Object.keys(TYPES),
    });
    // Two uploads at once can both find it missing; the loser's "already
    // exists" is success, not failure.
    if (error && !/exist/i.test(error.message)) {
      console.error('[api/uploads/logo] could not create the logos bucket:', error.message);
      return `The logo storage could not be prepared: ${error.message}`;
    }
    return null;
  }

  if (!bucket.public) {
    const { error } = await svc.storage.updateBucket(BUCKET, { public: true });
    if (error) {
      console.error('[api/uploads/logo] could not make the logos bucket public:', error.message);
      return 'The logo storage is private, so the logo would not display. Make the "logos" bucket public in Supabase, under Storage.';
    }
  }

  return null;
}

/** Delete this label's earlier files in the user's folder. Never fatal. */
async function sweep(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
  label: string,
  keep: string
): Promise<void> {
  try {
    const { data } = await svc.storage.from(BUCKET).list(userId, { limit: 100 });
    const stale = (data ?? [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keep && p.startsWith(`${userId}/${label}-`));
    if (stale.length) await svc.storage.from(BUCKET).remove(stale);
  } catch (e) {
    console.error('[api/uploads/logo] old logo cleanup skipped:', (e as Error).message);
  }
}

/** Filenames are ours to choose, so only our own characters are allowed in. */
function slug(v: FormDataEntryValue | null): string {
  if (typeof v !== 'string') return '';
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
