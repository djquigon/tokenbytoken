// Shown before the first message (CLAUDE.md §10). Keep in line with /privacy.

import Link from 'next/link';

export function PrivacyNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <section className="notice notice-privacy" aria-labelledby="privacy-notice-title">
      <h2 id="privacy-notice-title" className="notice-title">
        Before you send a message
      </h2>
      <ul>
        <li>Your messages are sent to OpenAI to generate replies.</li>
        <li>This site doesn&apos;t store your conversation on its servers. It stays in this browser tab.</li>
        <li>OpenAI keeps records of API traffic for up to 30 days to check for abuse, and by default doesn&apos;t use it to train models.</li>
        <li>Please don&apos;t share personal or sensitive information.</li>
      </ul>
      <div className="notice-actions">
        <button type="button" className="btn btn-primary" onClick={onAccept}>
          I understand
        </button>
        <Link href="/privacy">Read the privacy page</Link>
      </div>
    </section>
  );
}
