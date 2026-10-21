import type { Metadata } from 'next';
import { Smartphone, TabletSmartphone, Monitor, Download } from 'lucide-react';
import { BentoCard } from '@/components/kit';
import AndroidSteps from '@/components/app/AndroidSteps';
import { ApkLink } from '@/components/app/GetAndroidApp';
import { ANDROID_APP, IOS_APP_URL } from '@/lib/nativeApp';

export const metadata: Metadata = {
  title: 'Get the app',
  description:
    'Get the AIBOS app for Android straight from this website: full screen, with phone alerts and shortcuts to record a sale, add a booking or ask a question.',
  alternates: { canonical: '/download' },
};

// The page to send anyone who asks "where do I get the app?" (owner, 21 Oct
// 2026). The Android app downloads from here; the iPhone app comes from the
// App Store once Apple lists it (lib/nativeApp.ts, IOS_APP_URL).
export default function DownloadPage() {
  return (
    <>
      <section className="mkt-section mkt-section--tight">
        <div className="mkt-wrap" style={{ textAlign: 'center' }}>
          <p className="mkt-eyebrow">Get the app</p>
          <h1 className="mkt-h1" style={{ maxWidth: 780, marginInline: 'auto' }}>
            AIBOS on your phone, one tap away.
          </h1>
          <p className="mkt-lead" style={{ marginTop: 18, marginInline: 'auto', maxWidth: 560 }}>
            The AIBOS app opens straight on your business, full screen, with alerts on your lock screen and shortcuts to record a sale, add a booking or ask a question.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-section--tight" aria-label="Phones and computers" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="bento-grid">
            <BentoCard
              className="span-4 rows-2"
              icon={<Smartphone />}
              title="Android"
              tag={`Version ${ANDROID_APP.version}`}
              titleAs="h2"
              text={
                <>
                  <span className="unless-android">Open <strong>ai-bos.website/download</strong> on your Android phone and tap Download there. </span>
                  Every change we make reaches the app by itself, so you install it once.
                </>
              }
            >
              <div style={{ marginTop: 20, display: 'grid', gap: 24, justifyItems: 'start' }}>
                <ApkLink className="pill pill-primary pill-lg">
                  Download for Android <Download aria-hidden />
                </ApkLink>
                <AndroidSteps />
              </div>
            </BentoCard>

            <BentoCard
              className="span-2"
              icon={<TabletSmartphone />}
              title="iPhone and iPad"
              tag={IOS_APP_URL ? 'App Store' : 'On its way'}
              titleAs="h2"
              text={IOS_APP_URL
                ? 'Get AIBOS from Apple, then remove any AIBOS you added to your Home Screen from Safari.'
                : 'The iPhone app is on its way to the App Store. Until it arrives, open ai-bos.website in Safari, tap Share, then Add to Home Screen.'}
              foot={IOS_APP_URL ? (
                <a href={IOS_APP_URL} className="pill pill-primary" rel="noopener">Get the iPhone app</a>
              ) : undefined}
            />

            <BentoCard
              className="span-2"
              icon={<Monitor />}
              title="Computer"
              titleAs="h2"
              text="In Chrome or Edge, sign in and choose Install AIBOS from the address bar. On a Mac in Safari, choose File, then Add to Dock."
            />
          </div>
        </div>
      </section>
    </>
  );
}
