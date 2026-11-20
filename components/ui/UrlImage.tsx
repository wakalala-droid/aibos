// components/ui/UrlImage.tsx
// A picture from a web address AIBOS was given: an owner's logo, a Google
// profile photo, a business's logo from the setup lookup (audit 19 Nov 2026,
// done 20 Nov). Through next/image, so a logo uploaded at 2,000px reaches a
// phone at the size it is shown: the 28px logo in the dashboard header was the
// whole file on every page, and the logo on a customer's pay page came down a
// slow line in full.
//
// Only the hosts next.config.js lets the optimiser fetch are optimised
// (Supabase storage, where logos are uploaded, and Google photos). Any other
// address, and a data: or blob: preview, loads as it is, as before: next/image
// stops the page on a host it was not told about.
//
// The brand's own small files stay plain <img> on purpose (BootSplash is
// preloaded, DocHeader prints, BrandMark is a fixed mark), and so does the
// hero poster, which switches by device in plain HTML before any script runs.

import Image, { type ImageProps } from 'next/image';

/** Whether next.config.js `images.remotePatterns` covers this address (or it is a file of this site). */
export function optimisable(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  try {
    const u = new URL(src);
    if (u.protocol !== 'https:') return false;
    if (u.hostname === 'lh3.googleusercontent.com') return true;
    return u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/public/');
  } catch {
    return false;
  }
}

type Props = Omit<ImageProps, 'src' | 'unoptimized'> & { src: string };

export default function UrlImage({ src, alt, ...rest }: Props) {
  return <Image src={src} alt={alt} unoptimized={!optimisable(src)} {...rest} />;
}

/** A logo shown whole, in its own proportions, inside a box of at most `w` by `h` pixels. */
export const LOGO_FIT: React.CSSProperties = {
  maxHeight: '100%', maxWidth: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block',
};
