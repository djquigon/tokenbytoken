'use client';

// The message box. While a reply streams, Send becomes Stop and the draft is kept.

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { REQUEST_LIMITS } from '@/shared/limits';

export function Composer({
  disabled,
  streaming,
  onSend,
  onStop,
}: {
  disabled: boolean;
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const max = REQUEST_LIMITS.maxMessageChars;
  const nearLimit = draft.length > max * 0.9;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (disabled || streaming || draft.trim().length === 0) return;
    onSend(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <form className="composer" onSubmit={submit}>
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
        placeholder={disabled ? 'Read the note above to start' : 'Ask anything…'}
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
          <button type="submit" className="btn btn-primary" disabled={disabled || draft.trim().length === 0}>
            Send
          </button>
        )}
      </div>
    </form>
  );
}
