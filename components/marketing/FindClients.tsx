'use client';

import Link from 'next/link';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import { Notice } from '@/components/kit';
import Rise from '@/components/marketing/Rise';
import { FIND_CLIENTS_PER_MONTH as PER } from '@/lib/tiers';

// Find clients on the website (7 Nov 2026: on every plan, Free included).
// Drawn as the kit's own notices, the way the page shows a message ready to
// send and the search behind it. The seller, the guest house and the message
// are a sample; the caption says so. The numbers come from lib/tiers.ts, so
// the site never promises a different month from the one the server counts.
const VALUES = [
  'Businesses found around 16 Zambian towns, or from a list of your own',
  'Each one read and scored, so you write only to the ones that fit',
  'Nothing goes out until you press send in your own email or WhatsApp',
];

export default function FindClients() {
  return (
    <section id="find-clients" className="mkt-section" aria-labelledby="clients-h">
      <div className="mkt-wrap mkt-split">
        <div>
          <p className="mkt-eyebrow">Find clients, on every plan</p>
          <h2 id="clients-h" className="mkt-h2">Find your next customers.</h2>
          <p className="mkt-lead" style={{ marginTop: 20, maxWidth: 520 }}>
            Say in one line what you sell and who to. AIBOS finds businesses near you that could buy,
            reads their websites, says how well each one fits and writes the first message. You read it
            and send it yourself.
          </p>
          <p className="mkt-lead" style={{ marginTop: 16, maxWidth: 520 }}>
            Free researches {PER.free} businesses a month, Pro {PER.pro}, Pro+ {PER.proplus} and
            Growth {PER.growth}.
          </p>
          <ul className="mkt-values">
            {VALUES.map((v) => (
              <li key={v}><Check aria-hidden />{v}</li>
            ))}
          </ul>
          <div className="mkt-actions" style={{ marginTop: 28 }}>
            <Link href="/login?redirectTo=%2Fdashboard%2Fclients" className="pill pill-primary pill-lg">
              Show me who could buy from me <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>

        <div className="mkt-preview">
          {/* The notices as the light app shows them, floating on the navy. */}
          <Rise className="mkt-preview mkt-brief" mode="seq" theme="light">
            <Notice
              brand
              art
              theme="light"
              title="Ready to send"
              tag="Fits 86 of 100"
              role="region"
              ariaLabel="A sample message ready to send"
              actions={
                <>
                  <span className="pill pill-primary">Send by email</span>
                  <span className="pill pill-quiet">Send on WhatsApp</span>
                </>
              }
            >
              <p style={{ margin: 0 }}>
                <strong>Chanda Guest House, Livingstone.</strong> Has a working website, takes group bookings
                and has an email address.
              </p>
              <p style={{ margin: '8px 0 0' }}>
                Hello Mary, I came across Chanda Guest House and your weekend group bookings. I&apos;m Bwalya
                from Linen Care. We wash and return guest linen within a day. Could I send you a few short ideas?
              </p>
            </Notice>
            <Notice
              icon={MapPin}
              title="Found on the map"
              tag="Livingstone"
              role="region"
              ariaLabel="A sample map search"
            >
              <strong>45 lodges, guest houses and hotels</strong> around Livingstone. AIBOS read the first 10 and
              wrote to the 6 that fit.
            </Notice>
          </Rise>
          <p className="mkt-preview-cap">
            A sample business. AIBOS writes from your own line and each business&apos;s own website.
          </p>
        </div>
      </div>
    </section>
  );
}
