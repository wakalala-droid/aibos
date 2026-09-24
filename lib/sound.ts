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

let element: HTMLAudioElement | null = null;

export function soundOn(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}

/** Play the reminder sound, unless it is switched off here. Never throws. */
export function playReminderSound(): void {
  if (typeof window === 'undefined' || !soundOn()) return;
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
