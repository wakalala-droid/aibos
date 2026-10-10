'use client';

import { useEffect } from 'react';

/**
 * The navy backdrop (app/navy.css): the sky layer plus a class on <html> so
 * a phone's overscroll shows navy instead of a white strip. Used by the
 * public website and the sign-in page.
 */
export default function NavyPage() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('navy-page');
    return () => html.classList.remove('navy-page');
  }, []);
  return <div className="navy-sky" aria-hidden="true" />;
}
