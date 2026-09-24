// lib/sound.ts — the short sound a reminder makes while AIBOS is open.
//
// WHAT A WEBSITE CAN AND CANNOT DO WITH SOUND. A notification that arrives with
// AIBOS closed is played by the phone or computer itself, with whatever sound
// its owner has chosen for notifications. The Notification API has a `sound`
// option that no browser ever implemented, so nothing here can change that one.
// This sound is the one AIBOS plays itself, in the tab, the moment a reminder
// card appears in front of the owner.
//
// A browser refuses to play anything until the person has clicked in the page,
// so a refusal is normal and silent: a quiet reminder is still a reminder.
// The choice is remembered on the device, not on the account, because it is
// about this screen and this room.

const SRC = '/sounds/reminder.mp3';
const KEY = 'aibos-reminder-sound-v1';
// One tone per arrival. A notification reaches the app twice: the service
// worker says it landed, and up to a minute later the bell's feed brings the
// same thing on screen as a card.
const QUIET_MS = 90_000;

let element: HTMLAudioElement | null = null;
let lastPlayed = 0;

export function soundOn(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}

/** Play the reminder sound, unless it is switched off here or one has just
 *  played. `force` is the switch itself, which always plays. Never throws. */
export function playReminderSound(force = false): void {
  if (typeof window === 'undefined' || !soundOn()) return;
  if (!force && Date.now() - lastPlayed < QUIET_MS) return;
  lastPlayed = Date.now();
  try {
    if (!element) {
      element = new Audio(SRC);
      element.preload = 'auto';
      element.volume = 0.7;
    }
    element.currentTime = 0;
    void element.play().catch(() => { /* no click in the page yet, or no audio */ });
  } catch { /* a device with no audio at all */ }
}

/** Play the tone the moment a notification lands, for as long as AIBOS is
 *  open: on the installed app, in another tab, or behind other windows. The
 *  service worker names one window to tell, so it is never played twice.
 *  Returns the function that stops listening. */
export function listenForNotifications(): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => { /* nothing to stop */ };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string } | null;
    if (data && data.type === 'aibos-notification') playReminderSound();
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
