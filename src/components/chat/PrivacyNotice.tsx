// Shown before the first message (CLAUDE.md §10). Keep in line with /privacy.

import Link from 'next/link';

/** `ready` is false until the page is interactive: the notice is server-rendered, and an earlier click would be lost. */
export function PrivacyNotice({ onAccept, ready = true }: { onAccept: () => void; ready?: boolean }) {
  return (
    <section className="notice notice-privacy" aria-labelledby="privacy-notice-title">
      <h2 id="privacy-notice-title" className="notice-title">
        Before you send a message
      </h2>
      <ul>
        <li>Your messages are sent to OpenAI to generate replies.</li>
        <li>This site doesn&apos;t store your conversation on its servers. It stays in this browser tab.</li>
        <li>OpenAI can retain messages in abuse-monitoring logs, including beyond its default retention period for legal or harm-prevention reasons. By default, API messages aren&apos;t used to train models.</li>
        <li>Please don&apos;t share personal or sensitive information.</li>
      </ul>
      <div className="notice-actions">
        <button type="button" className="btn btn-primary" onClick={onAccept} disabled={!ready}>
          I understand
        </button>
        <Link href="/privacy">Read the privacy page</Link>
      </div>
    </section>
  );
}
