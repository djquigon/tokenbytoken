'use client';

// The chat page: the conversation beside the walkthrough of the selected reply (docs/PLAN.md §1–2).
// Desktop: chat about 38%, walkthrough about 62%. Narrow screens: "Chat | How it works" tabs.
// After each reply the walkthrough is offered, and the composer unlocks when it ends or is skipped.
// With `sample`, it replays a recorded conversation instead: read-only, and nothing is sent.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { useHydratePrefs, usePrefs } from '@/components/prefs/hooks';
import { PrefsMenu } from '@/components/prefs/PrefsMenu';
import { prefsStore } from '@/components/prefs/store';
import { Datum } from '@/components/provenance/Datum';
import { LabelChip } from '@/components/provenance/ProvBadge';
import { Walkthrough } from '@/components/walkthrough/Walkthrough';
import { sendTurn } from '@/generation/client';
import { createConversationStore, traceOf, type Turn } from '@/generation/conversation-store';
import { CONVERSATION_KEY, safeStorage, type KeyValueStorage } from '@/generation/persist';
import { canCompile } from '@/playback/compile/compile';
import { clientMs } from '@/shared/units';

import { Composer } from './Composer';
import { PrivacyNotice } from './PrivacyNotice';
import { Tour } from './Tour';
import { TurnView } from './TurnView';

/** The browser gives up on a silent stream after this long; the server sends a heartbeat every 15 s. */
const CLIENT_IDLE_TIMEOUT_MS = 45_000;

const hasWalkthrough = (turn: Turn) => {
  const trace = traceOf(turn);
  return trace !== null && canCompile(trace);
};

/** Serves a recorded conversation as if it were this tab's own, and ignores writes. */
const readOnlyStorage = (conversation: unknown): KeyValueStorage => {
  const json = JSON.stringify(conversation);
  return { getItem: (key) => (key === CONVERSATION_KEY ? json : null), setItem: () => undefined, removeItem: () => undefined };
};

export function ChatApp({ sample }: { sample?: { conversation: unknown } } = {}) {
  useHydratePrefs();
  const [store] = useState(() =>
    createConversationStore({
      sendTurn,
      now: () => clientMs(performance.timeOrigin + performance.now()),
      randomId: () => crypto.randomUUID(),
      storage: sample ? readOnlyStorage(sample.conversation) : safeStorage('session'),
      preferences: sample ? null : safeStorage('local'),
      idleTimeoutMs: CLIENT_IDLE_TIMEOUT_MS,
      scheduleFlush: (flush) => requestAnimationFrame(() => flush()),
      // A sample needs no browser storage, so it loads at once and the server renders the whole conversation.
      hydrateAtCreation: Boolean(sample),
    }),
  );
  const turns = useStore(store, (s) => s.turns);
  const streaming = useStore(store, (s) => s.streaming);
  const hydrated = useStore(store, (s) => s.hydrated);
  const storageNote = useStore(store, (s) => s.storageNote);
  const privacyAccepted = useStore(store, (s) => s.privacyAccepted);
  const announcement = useStore(store, (s) => s.announcement);
  const tourSeen = usePrefs((s) => s.tourSeen);
  const prefsReady = usePrefs((s) => s.hydrated);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'chat' | 'walkthrough'>('chat');
  const [autoplayId, setAutoplayId] = useState<string | null>(null);

  useEffect(() => {
    store.getState().hydrate();
    // React's own state decides from now on (see CHAT_PRELOAD_SCRIPT).
    delete document.documentElement.dataset.privacy;
    delete document.documentElement.dataset.conversation;
  }, [store]);

  // When a reply finishes, offer its walkthrough and lock the composer until it's watched or skipped.
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (!prev.streaming || s.streaming) return;
        const last = s.turns.at(-1);
        if (!last || !hasWalkthrough(last)) return;
        setSelectedId(last.id);
        setPendingId(last.id);
        if (prefsStore.getState().autoplay) setAutoplayId(last.id);
      }),
    [store],
  );

  const selected = useMemo(() => {
    const byId = turns.find((t) => t.id === selectedId && hasWalkthrough(t));
    return byId ?? [...turns].reverse().find((t) => t.done && hasWalkthrough(t)) ?? null;
  }, [turns, selectedId]);
  const selectedTrace = selected ? traceOf(selected) : null;

  // Stable callbacks, so memoized turns don't re-render (and re-parse their Markdown) on every change.
  const clear = useCallback(() => {
    store.getState().clear();
    setSelectedId(null);
    setPendingId(null);
  }, [store]);
  const retry = useCallback(() => void store.getState().retryLast(), [store]);
  const explain = useCallback((turnId: string) => {
    setSelectedId(turnId);
    setTab('walkthrough');
  }, []);

  const locked = pendingId !== null;
  // Stable, so the memoized walkthrough doesn't re-render when the chat does.
  const shownId = selected?.id ?? null;
  const onFinished = useCallback(() => {
    setPendingId((p) => (p !== null && p === shownId ? null : p));
  }, [shownId]);

  return (
    <div className="app">
      <header className="app-header">
        <Link href="/" className="brand">
          Token by Token
        </Link>
        <nav aria-label="Site">
          {sample ? (
            <Link href="/chat" className="nav-own-line">
              Ask your own question
            </Link>
          ) : (
            <button type="button" className="btn btn-quiet" onClick={clear} disabled={turns.length === 0 && !streaming}>
              Clear conversation
            </button>
          )}
          <PrefsMenu />
          <Link href="/faq">FAQ</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </header>

      <div className="workspace" data-tab={tab}>
        {/* Narrow screens show one pane at a time; wide screens show both and hide this switch. */}
        <div className="pane-switch segmented" role="group" aria-label="Show">
          <button type="button" aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>
            Chat
          </button>
          <button type="button" aria-pressed={tab === 'walkthrough'} onClick={() => setTab('walkthrough')}>
            How it works
            {locked && tab === 'chat' ? (
              <>
                <span className="pane-dot" aria-hidden="true" />
                <span className="sr-only"> (new walkthrough)</span>
              </>
            ) : null}
          </button>
        </div>

        <main className="chat-pane chat-column" id="main">
          <h1 className="sr-only">Chat</h1>
          {storageNote ? <p className="notice">{storageNote}</p> : null}
          {sample ? <SampleNote turns={turns} /> : null}
          {!sample && (!tourSeen || !prefsReady) ? <Tour ready={hydrated && prefsReady} /> : null}
          {!sample && (!hydrated || turns.length === 0) ? (
            <p className="chat-empty">
              Ask a question. When the reply arrives, a walkthrough shows how it was made, step by step, using your own
              message and the real data behind the reply.
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
                selected={selected?.id === turn.id}
                canExplain={hasWalkthrough(turn)}
                onExplain={explain}
                onRetry={retry}
                onClear={clear}
              />
            ))}
          </div>
          {sample ? null : privacyAccepted === false || !hydrated ? <PrivacyNotice onAccept={() => store.getState().acceptPrivacy()} ready={hydrated} /> : null}
          {sample ? null : (
            <Composer
            disabled={privacyAccepted !== true || !hydrated}
            streaming={streaming}
            locked={locked ? { onSkip: () => setPendingId(null), onShow: () => setTab('walkthrough') } : null}
            onSend={(text) => void store.getState().send(text)}
            onStop={() => store.getState().stop()}
            />
          )}
        </main>

        <aside className="walkthrough-pane" id="walkthrough-pane" aria-label="How it works">
          {selected && selectedTrace ? (
            <Walkthrough
              key={selected.id}
              trace={selectedTrace}
              autoplay={autoplayId === selected.id}
              onFinished={onFinished}
            />
          ) : (
            <WalkthroughIntro />
          )}
        </aside>
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

/** Before the first reply: the steps the walkthrough covers, each with the labels of the values it shows. */
function WalkthroughIntro() {
  return (
    <div className="walkthrough-intro">
      <h2 className="section-title">How it works</h2>
      <p className="intro-lede">
        After a reply arrives, this panel walks through how it was made, step by step, using your own message and the real data behind the
        reply.
      </p>
      <ol className="intro-steps">
        <li className="intro-step">
          <h3>Your message</h3>
          <p>What this app sends: its instructions, the chat so far, and your message.</p>
          <p className="intro-labels">
            <LabelChip kind="recorded" />
          </p>
        </li>
        <li className="intro-step">
          <h3>Text becomes tokens</h3>
          <p>Your message is split into tokens, the small pieces of text a model works with.</p>
          <p className="intro-labels">
            <LabelChip kind="calculated" />
          </p>
        </li>
        <li className="intro-step">
          <h3>Next-token choices</h3>
          <p>At every step, the real options for the next token, as percentages. Drawings of the network in between are examples.</p>
          <p className="intro-labels">
            <LabelChip kind="calculated" />
            <LabelChip kind="example" />
          </p>
        </li>
        <li className="intro-step">
          <h3>The reply is built</h3>
          <p>A weighted random pick adds one token at a time, until the reply ends.</p>
          <p className="intro-labels">
            <LabelChip kind="recorded" />
          </p>
        </li>
      </ol>
      <p className="intro-note">Every value is labeled Recorded, Calculated, Reference, or Example, always as a word, never just a color.</p>
    </div>
  );
}

/** Says what the sample is: when it was recorded and with which model, both as labeled values. */
function SampleNote({ turns }: { turns: readonly Turn[] }) {
  const first = turns[0] ? traceOf(turns[0]) : null;
  const sent = first?.timing.browser.requestSent ?? null;
  return (
    <section className="notice sample-note" aria-label="About this sample">
      <p className="notice-title">A recorded sample conversation</p>
      <p>
        Recorded through this app{sent ? <> on <Datum of={sent} as="date" compact /></> : null}
        {first?.model ? <> with <Datum of={first.model} as="text" compact /></> : null}. Nothing is sent from this page, and replaying it costs
        nothing. Every value in it is labeled, just as in your own conversations.
      </p>
      <p>
        <Link href="/chat" className="btn btn-primary">
          Ask your own question
        </Link>
      </p>
    </section>
  );
}
