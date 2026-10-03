'use client';

// Settings: theme, effects, motion, and the live view. A disclosure (not a
// modal), so it never traps focus; Esc closes it.

import { useRef } from 'react';

import { SettingsIcon } from '@/components/ui/icons';

import { useHydratePrefs, usePrefs } from './hooks';
import { prefsStore, type Preferences } from './store';

function Choice<K extends keyof Preferences>({
  name,
  label,
  options,
}: {
  name: K;
  label: string;
  options: readonly { value: Preferences[K]; label: string }[];
}) {
  const value = usePrefs((s) => s[name]);
  return (
    <fieldset className="pref">
      <legend>{label}</legend>
      <div className="segmented">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => prefsStore.getState().set({ [name]: o.value } as Partial<Preferences>)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PrefsMenu() {
  // Before saving a change, the store must hold this viewer's earlier choices (hydrate runs once).
  useHydratePrefs();
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={details}
      className="prefs-menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && details.current?.open) {
          details.current.open = false;
          details.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="btn btn-quiet">
        <SettingsIcon /> Settings
      </summary>
      <div className="prefs-panel panel">
        <Choice name="theme" label="Theme" options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
        <Choice name="effects" label="Visual effects (glow, token rain)" options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
        <Choice
          name="motion"
          label="Motion"
          options={[
            { value: 'system', label: 'Follow my device' },
            { value: 'reduce', label: 'Reduce' },
            { value: 'full', label: 'Full' },
          ]}
        />
        <Choice name="liveStrip" label="Live view while a reply arrives" options={[{ value: true, label: 'Show' }, { value: false, label: 'Hide' }]} />
        <button type="button" className="btn btn-quiet" onClick={() => prefsStore.getState().set({ tourSeen: false })}>
          Show the chat page tour again
        </button>
      </div>
    </details>
  );
}
