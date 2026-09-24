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

/** Play the reminder sound and say whether it was heard. `force` is a real new
 *  notification (or the switch itself); without it a tone that has just played
 *  is not repeated. Never throws: false simply means the device stayed quiet,
 *  and the service worker then lets the notification make its own sound. */
export async function playReminderSound(force = false): Promise<boolean> {
  if (typeof window === 'undefined' || !soundOn()) return false;
  if (!force && Date.now() - lastPlayed < QUIET_MS) return false;
  try {
    if (!element) {
      element = new Audio(SRC);
      element.preload = 'auto';
      element.volume = 0.7;
    }
    element.currentTime = 0;
    await element.play();
    lastPlayed = Date.now();
    return true;
  } catch {
    return false;   // no click in the page yet, no audio, or a frozen tab
  }
}

/** Play the tone the moment a notification lands, for as long as AIBOS is
 *  open: on the installed app, in another tab, or behind other windows.
 *
 *  The service worker asks ONE window first and waits for the answer. Saying
 *  yes makes the notification itself silent, so the owner hears AIBOS's own
 *  tone and nothing else; saying no (the sound is switched off here, the tab
 *  is frozen, or the browser will not play yet) leaves the notification to
 *  make the device's usual sound. Either way something is heard, once.
 *  Returns the function that stops listening. */
export function listenForNotifications(): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => { /* nothing to stop */ };
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string } | null;
    if (!data || data.type !== 'aibos-notification') return;
    const reply = event.ports && event.ports[0];
    void playReminderSound(true).then((played) => {
      try { reply?.postMessage({ played }); } catch { /* the worker moved on */ }
    });
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
