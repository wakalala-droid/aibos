// lib/talkEvent.ts
// Start talking to AI-BOS from anywhere (Home's "Talk to AI-BOS", the team
// scene, the chat's Talk button). Since 28 Nov 2026 AI-BOS is one: the sphere
// (components/guide/GuideSphere.tsx) takes every "Talk" and answers live.
// When the live guide cannot run (an old browser, no minutes left, Google
// resting) the sphere hands over to the earlier Talk, which the chat owns
// (components/ui/glowing-ai-chat-assistant.tsx) and which listens for
// TALK_EVENT. Call from a tap: phones only let a page listen after one.

export const GUIDE_EVENT = 'aibos:guide';
export const TALK_EVENT = 'aibos:talk';

export type GuideMode = 'guide' | 'report';

/** Talk to AI-BOS: the live sphere, or the earlier Talk where it cannot run. */
export function startTalk(mode: GuideMode = 'guide'): void {
  // Anything but 'report' (a click event passed by mistake) is a plain talk.
  const m: GuideMode = mode === 'report' ? 'report' : 'guide';
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: { mode: m } }));
}

/** The earlier Talk (the browser's own speech), for when the live sphere cannot run. */
export function startBrowserTalk(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TALK_EVENT));
}
