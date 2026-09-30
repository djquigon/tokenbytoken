import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy · Token by Token',
  description: 'What happens to your messages on Token by Token.',
};

// Keep in line with OpenAI's data-controls page and the privacy notice in the chat (CLAUDE.md §10).
const OPENAI_DATA_PAGE = 'https://developers.openai.com/api/docs/guides/your-data';
const OPENAI_CACHING_PAGE = 'https://developers.openai.com/api/docs/guides/prompt-caching';
const REVIEWED = '2026-09-30';

export default function PrivacyPage() {
  return (
    <main className="prose-page" id="main">
      <p>
        <Link href="/">Token by Token</Link>
      </p>
      <h1>Privacy</h1>
      <p className="muted">
        Last reviewed <time dateTime={REVIEWED}>September 30, 2026</time>. Token by Token is a personal, non-commercial
        project. It is not directed at children.
      </p>

      <h2>What this site does with your messages</h2>
      <ul>
        <li>
          When you send a message, this site&apos;s server passes it to OpenAI&apos;s API to generate a reply, together with
          the earlier turns of your conversation and this site&apos;s instructions (which the chat shows word for word).
          It asks OpenAI not to store the response for later use (<code>store: false</code>).
        </li>
        <li>Before that, your message is checked by OpenAI&apos;s moderation model.</li>
        <li>
          This site doesn&apos;t store your conversation on its servers and doesn&apos;t log what you write. Server logs
          contain only request IDs, sizes, token counts, timings, costs, and error codes.
        </li>
        <li>
          Your conversation is kept in this browser tab (session storage) so you can inspect it. Closing the tab or
          choosing <strong>Clear conversation</strong> removes it.
        </li>
        <li>
          To enforce fair-use limits and a daily budget, the server keeps counters under hashed identifiers of your
          browser tab and IP address, never the raw values. They expire within two days.
        </li>
        <li>
          OpenAI receives a hashed identifier of your browser tab&apos;s session (a “safety identifier”) so it can
          detect abuse without knowing who you are.
        </li>
        <li>
          On the deployed site, Vercel&apos;s bot protection runs a check in your browser to confirm that requests come
          from a real browser. This site uses no analytics.
        </li>
      </ul>

      <h2>What OpenAI does with them</h2>
      <p>
        According to OpenAI&apos;s{' '}
        <a href={OPENAI_DATA_PAGE} rel="noopener noreferrer">
          data controls page
        </a>{' '}
        (retrieved {REVIEWED}):
      </p>
      <ul>
        <li>Data sent to OpenAI&apos;s API isn&apos;t used to train its models unless the account owner opts in. This site hasn&apos;t.</li>
        <li>
          OpenAI keeps abuse-monitoring logs, which can include prompts and replies, for up to 30 days, or longer where
          the law requires it.
        </li>
        <li>
          Because this site sends <code>store: false</code>, OpenAI doesn&apos;t keep the reply as stored application
          data. For longer conversations, OpenAI may keep cached intermediate results of the start of a request (not
          its text) for up to 24 hours, to speed up later requests that start the same way. These caches aren&apos;t
          shared with other organizations (
          <a href={OPENAI_CACHING_PAGE} rel="noopener noreferrer">
            prompt caching guide
          </a>
          ).
        </li>
      </ul>

      <h2>Please don&apos;t share personal information</h2>
      <p>
        Anything you type is sent to OpenAI. Please don&apos;t include names, contact details, health or financial
        information, or anything else you wouldn&apos;t want a third party to process.
      </p>
    </main>
  );
}
