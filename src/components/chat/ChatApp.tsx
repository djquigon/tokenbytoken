'use client';

// The chat page: the conversation, the composer, and the privacy notice before the first message.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';

import { sendTurn } from '@/generation/client';
import { createConversationStore } from '@/generation/conversation-store';
import { safeStorage } from '@/generation/persist';
import { clientMs } from '@/shared/units';

import { Composer } from './Composer';
import { PrivacyNotice } from './PrivacyNotice';
import { TurnView } from './TurnView';

/** The browser gives up on a silent stream after this long; the server sends a heartbeat every 15 s. */
const CLIENT_IDLE_TIMEOUT_MS = 45_000;

export function ChatApp() {
  const [store] = useState(() =>
    createConversationStore({
      sendTurn,
      now: () => clientMs(performance.timeOrigin + performance.now()),
      randomId: () => crypto.randomUUID(),
      storage: safeStorage('session'),
      preferences: safeStorage('local'),
      idleTimeoutMs: CLIENT_IDLE_TIMEOUT_MS,
      scheduleFlush: (flush) => requestAnimationFrame(() => flush()),
    }),
  );
  const turns = useStore(store, (s) => s.turns);
  const streaming = useStore(store, (s) => s.streaming);
  const hydrated = useStore(store, (s) => s.hydrated);
  const storageNote = useStore(store, (s) => s.storageNote);
  const privacyAccepted = useStore(store, (s) => s.privacyAccepted);
  const announcement = useStore(store, (s) => s.announcement);

  useEffect(() => store.getState().hydrate(), [store]);

  const clear = () => store.getState().clear();

  return (
    <div className="chat">
      <header className="chat-header">
        <Link href="/" className="brand">
          Token by Token
        </Link>
        <nav aria-label="Chat">
          <button type="button" className="btn btn-quiet" onClick={clear} disabled={turns.length === 0 && !streaming}>
            Clear conversation
          </button>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </header>

      <main className="chat-main" id="main">
        <h1 className="sr-only">Chat</h1>
        {storageNote ? <p className="notice">{storageNote}</p> : null}
        {hydrated && turns.length === 0 ? (
          <p className="chat-empty">
            Ask a question. After each reply you can inspect the real data behind it: every token, its alternatives, and
            how this app and OpenAI handled the request.
          </p>
        ) : null}
        <div className="turns">
          {turns.map((turn, i) => (
            <TurnView
              key={turn.id}
              turn={turn}
              index={i}
              isLast={i === turns.length - 1}
              streaming={streaming}
              onRetry={() => void store.getState().retryLast()}
              onClear={clear}
            />
          ))}
        </div>
        {privacyAccepted === false ? <PrivacyNotice onAccept={() => store.getState().acceptPrivacy()} /> : null}
        <Composer
          disabled={privacyAccepted !== true || !hydrated}
          streaming={streaming}
          onSend={(text) => void store.getState().send(text)}
          onStop={() => store.getState().stop()}
        />
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
