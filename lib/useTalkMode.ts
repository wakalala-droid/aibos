'use client';
/**
 * Talk mode: the owner speaks to AI-BOS and AI-BOS speaks back (Jarvis, phase 1).
 *
 * Press Talk (or hold the AI-BOS button): AI-BOS greets the owner with one short
 * question ("Good afternoon. What are we working on?") and listens. Since
 * 17 Nov 2026 it no longer reads the whole brief first: the owner asked to be
 * listened to, not talked at. The brief is one sentence away ("brief me").
 * What the owner says goes to the ordinary chat (sendMessage), so every
 * answer, every lookup and the "sold 3 crates for K360" -> "confirm" flow work
 * by voice. Each answer is read aloud, then AI-BOS listens again.
 *
 * When nothing is heard AI-BOS listens once more, then rests on screen
 * ("Tap to talk") instead of vanishing; "that's all" or End finishes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/aiAssistant';
import { getSpokenBrief } from '@/lib/api';
import { canSpeak, listenMode, listenOnce, primeSpeech, speak, speakable, stopSpeaking } from '@/lib/voice';

export type TalkPhase = 'off' | 'briefing' | 'speaking' | 'listening' | 'thinking' | 'resting';

const STOP_WORDS = /^(stop|end|cancel talk|that'?s (all|it)|thank you,? that'?s (all|it)|thanks,? that'?s (all|it)|goodbye|bye|no,? that'?s (all|it)|nothing( else)?|no thanks?)[.!]*$/i;
const BRIEF_WORDS = /^(brief me|(give me |read me |what'?s )?(my |the )?(morning )?brief|what'?s (happening|new)( today)?)[.?!]*$/i;

const QUESTIONS = [
  'What are we working on?',
  'What would you like to work on?',
  'What can I do for you?',
  'What do you need?',
];

/** "Good afternoon. What are we working on?", by the clock on the owner's device. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${hello}. ${QUESTIONS[now.getMinutes() % QUESTIONS.length]}`;
}

interface Deps {
  messages: ChatMessage[];
  loading: boolean;
  sendMessage: (text: string) => void | Promise<void>;
  pushAssistant: (content: string) => void;
  setSuggestions: (s: string[]) => void;
}

export function useTalkMode({ messages, loading, sendMessage, pushAssistant, setSuggestions }: Deps) {
  const [phase, setPhase] = useState<TalkPhase>('off');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supported = canSpeak() && listenMode() !== null;

  const phaseRef = useRef<TalkPhase>('off');
  const set = useCallback((p: TalkPhase) => { phaseRef.current = p; setPhase(p); }, []);
  // A function, not a comparison: the phase changes while a step awaits.
  const isOff = useCallback(() => phaseRef.current === 'off', []);
  const abortRef = useRef<AbortController | null>(null);
  const lastIdRef = useRef<string | null>(null);         // the newest message before the owner spoke
  const quietRef = useRef(0);                            // turns in a row with nothing heard
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setHeard('');
    set('off');
  }, [set]);

  const say = useCallback(async (text: string) => {
    set('speaking');
    await speak(text);
  }, [set]);

  // Declared before listen (which calls it) through a ref, so the two can call each other.
  const briefRef = useRef<() => Promise<void>>(async () => {});

  const listen = useCallback(async () => {
    if (isOff()) return;
    abortRef.current?.abort();
    set('listening');
    setHeard('');
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let text = '';
    try {
      text = (await listenOnce({ onInterim: setHeard, signal: ctrl.signal })).trim();
    } catch {
      if (ctrl.signal.aborted || isOff()) return;
      setError('AI-BOS cannot hear you. Allow the microphone for this site, then tap the sphere.');
      set('resting');
      return;
    }
    if (ctrl.signal.aborted || isOff()) return;
    setHeard(text);
    if (!text) {
      // Quiet: listen once more, then rest on screen until the owner taps.
      quietRef.current += 1;
      if (quietRef.current < 2) { listen(); return; }
      quietRef.current = 0;
      set('resting');
      return;
    }
    quietRef.current = 0;
    if (STOP_WORDS.test(text)) {
      await say('Okay. I am here when you need me.');
      stop();
      return;
    }
    if (BRIEF_WORDS.test(text)) { await briefRef.current(); return; }
    lastIdRef.current = messagesRef.current[messagesRef.current.length - 1]?.id ?? null;
    set('thinking');
    sendMessage(text);
  }, [isOff, say, sendMessage, set, stop]);

  const brief = useCallback(async () => {
    set('briefing');
    let speech = 'I could not read your brief just now. What would you like me to handle?';
    try {
      const b = await getSpokenBrief();
      pushAssistant([b.greeting, ...b.lines, `**${b.question}**`].join('\n\n'));
      if (b.suggestions?.length) setSuggestions(b.suggestions);
      speech = b.speech;
    } catch { /* offline or the API asleep: still listen */ }
    if (isOff()) return;
    await say(speech);
    if (!isOff()) listen();
  }, [isOff, listen, pushAssistant, say, set, setSuggestions]);
  useEffect(() => { briefRef.current = brief; }, [brief]);

  /** Start talking: a short hello and a question, then listen. Call from a
   *  tap: phones only let a page talk or listen after one. */
  const start = useCallback(() => {
    if (!supported) {
      setError('This browser cannot talk yet. Chrome or Edge on a computer, or Chrome on Android, can.');
      return;
    }
    setError(null);
    quietRef.current = 0;
    primeSpeech();
    const hello = greeting();
    pushAssistant(hello);
    say(hello).then(() => { if (!isOff()) listen(); });
  }, [isOff, listen, pushAssistant, say, supported]);

  /** Tap while AI-BOS talks or rests: stop it and listen to the owner now. */
  const interrupt = useCallback(() => {
    if (phaseRef.current === 'off' || phaseRef.current === 'listening' || phaseRef.current === 'thinking') return;
    stopSpeaking();
    quietRef.current = 0;
    listen();
  }, [listen]);

  // The answer to what the owner said: read it aloud once complete, then listen again.
  useEffect(() => {
    if (phase !== 'thinking' || loading) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.id === lastIdRef.current) return;
    if (!last.content.trim()) return;
    lastIdRef.current = last.id;
    (async () => {
      await say(speakable(last.content));
      if (!isOff()) listen();
    })();
  }, [phase, loading, messages, say, listen, isOff]);

  useEffect(() => () => { abortRef.current?.abort(); stopSpeaking(); }, []);

  return { phase, heard, error, supported, start, stop, interrupt, clearError: () => setError(null) };
}
