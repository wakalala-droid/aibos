'use client';

// The one place toasts appear (UI/UX audit 2026-10 B1). Sonner in unstyled
// mode, so every pixel is ours: tokens, Geist, 18px words, radius 10, a 44px
// Undo button, sitting above the phone's bottom bar. Styles: globals.css
// "TOASTS". Sonner already announces through aria-live="polite" and honours
// prefers-reduced-motion.

import { Toaster } from 'sonner';

export default function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: 'calc(92px + env(safe-area-inset-bottom))' }}
      visibleToasts={3}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'aibos-toast',
          title: 'aibos-toast-title',
          description: 'aibos-toast-desc',
          actionButton: 'aibos-toast-action',
          error: 'aibos-toast-error',
        },
      }}
    />
  );
}
