'use client';

// The message box. While a reply streams, Send becomes Stop and the draft is kept. After a reply, sending is
// locked until its walkthrough ends or is skipped (CLAUDE.md §2.5); typing still works, and Skip is one click.

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { ArrowRightIcon } from '@/components/ui/icons';
import { REQUEST_LIMITS } from '@/shared/limits';

export function Composer({
  disabled,
  streaming,
  locked,
  onSend,
  onStop,
}: {
  disabled: boolean;
  streaming: boolean;
  /** Set while the latest reply's walkthrough hasn't been watched or skipped. */
  locked: { onSkip: () => void; onShow: () => void } | null;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const max = REQUEST_LIMITS.maxMessageChars;
  const nearLimit = draft.length > max * 0.9;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (disabled || streaming || locked || draft.trim().length === 0) return;
    onSend(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <form className="composer" onSubmit={submit} data-locked={locked ? 'true' : undefined}>
      {locked ? (
        <div className="composer-lock" role="status">
          <p>
            Next: see how this reply was made.{' '}
            <button type="button" className="link-button pane-only-narrow" onClick={locked.onShow}>
              Open the walkthrough
            </button>{' '}
            Play it or skip it to send another message.
          </p>
          <button type="button" className="btn" onClick={locked.onSkip}>
            Skip walkthrough
          </button>
        </div>
      ) : null}
      <label htmlFor={id} className="sr-only">
        Your message
      </label>
      <textarea
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={max}
        rows={3}
        placeholder={disabled ? 'Read the note above to start' : 'Ask a question… (e.g. “Why is the sky blue?”)'}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        dir="auto"
      />
      <div className="composer-row">
        <p id={`${id}-hint`} className="composer-hint">
          Enter to send, Shift+Enter for a new line.
          {nearLimit ? ` ${max - draft.length} characters left.` : ''}
        </p>
        {streaming ? (
          <button type="button" className="btn btn-stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={disabled || locked !== null || draft.trim().length === 0}>
            Send <ArrowRightIcon />
          </button>
        )}
      </div>
    </form>
  );
}
