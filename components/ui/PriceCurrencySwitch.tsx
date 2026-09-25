'use client';

/**
 * The US dollar / Kwacha switch for plan prices, and the note that goes with
 * Kwacha. Plans are charged in US dollars; Kwacha is a conversion at today's
 * rate, and the note says so every time it is shown (lib/planPrice.ts).
 */
import { useId } from 'react';
import { FX_SOURCE } from '@/lib/fx';
import { rateText, type PriceCurrency, type ZmwRate } from '@/lib/planPrice';
import './PriceCurrencySwitch.css';

export default function PriceCurrencySwitch({ currency, onChange, rate, loading, className = '' }: {
  currency: PriceCurrency;
  onChange: (c: PriceCurrency) => void;
  rate: ZmwRate | null;
  loading: boolean;
  className?: string;
}) {
  const labelId = useId();
  // No rate to convert with (the source is down): Kwacha is not offered
  // rather than shown at a guessed rate.
  const noKwacha = !loading && !rate;
  return (
    <div className={`pcs ${className}`}>
      <span className="pcs-label" id={labelId}>Show prices in</span>
      <div className="pcs-seg" role="radiogroup" aria-labelledby={labelId}>
        <button type="button" role="radio" aria-checked={currency === 'USD'} onClick={() => onChange('USD')}>
          US dollars
        </button>
        <button type="button" role="radio" aria-checked={currency === 'ZMW'} onClick={() => onChange('ZMW')}
          disabled={noKwacha || loading}
          title={noKwacha ? 'Today’s Kwacha rate could not be read. Prices are in US dollars.' : undefined}>
          Kwacha
        </button>
      </div>
    </div>
  );
}

function asOfDay(iso: string | null): string {
  if (!iso) return 'today’s rate';
  const d = new Date(iso);
  return `the rate on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** Shown wherever Kwacha prices are: what they are and what is charged. */
export function KwachaNote({ rate, className = '' }: { rate: ZmwRate; className?: string }) {
  return (
    <p className={`pcs-note ${className}`}>
      Kwacha prices are a guide, converted at {rateText(rate)} ({asOfDay(rate.asOf)}). You are charged in
      US dollars, so your bank or card sets the exact Kwacha amount. Rates by{' '}
      <a href={FX_SOURCE.url} target="_blank" rel="noopener noreferrer">{FX_SOURCE.name}</a>.
    </p>
  );
}
