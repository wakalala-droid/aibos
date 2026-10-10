import Link from 'next/link';
import { NoticeArt } from '@/components/kit';
import Rise from '@/components/marketing/Rise';

// The last word on a marketing page, built from the kit's notice: the
// splash's art strip (tiles, the money line, the mark in its rings, the
// double arrow) over a title, plain words and the pills. It is the light
// product on the navy page, like the app's What's new screen.
export default function StartFree({
  id,
  title,
  text,
  primary = { label: 'Start free', href: '/login' },
  secondary = { label: 'See pricing', href: '/pricing' },
  note,
}: {
  id: string;
  title: React.ReactNode;
  text: React.ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
  note?: React.ReactNode;
}) {
  return (
    <section className="mkt-section" aria-labelledby={id}>
      <div className="mkt-wrap">
        <Rise className="notice mkt-final" theme="light">
          <NoticeArt theme="light" />
          <div className="mkt-final-body">
            <h2 id={id} className="mkt-h2">{title}</h2>
            <p className="mkt-lead" style={{ marginTop: 16, marginInline: 'auto', maxWidth: 540 }}>{text}</p>
            <div className="mkt-actions" style={{ justifyContent: 'center', marginTop: 28 }}>
              <Link href={primary.href} className="pill pill-primary pill-lg">{primary.label}</Link>
              {secondary && <Link href={secondary.href} className="pill pill-quiet pill-lg">{secondary.label}</Link>}
            </div>
            {note && <p className="mkt-preview-cap" style={{ marginTop: 16 }}>{note}</p>}
          </div>
        </Rise>
      </div>
    </section>
  );
}
