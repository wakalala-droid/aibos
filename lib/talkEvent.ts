// lib/talkEvent.ts
// Start talking to AIBOS from anywhere (Home's "Talk to AIBOS", the team
// page): the floating assistant owns the conversation and listens for this.
// Call it from a tap: phones only let a page listen after one.

export const TALK_EVENT = 'aibos:talk';

export function startTalk(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TALK_EVENT));
}
