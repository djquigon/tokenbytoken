// The site's wordmark in the header bars (ADR 0012): the next-token fork, then the address,
// howdoesanai.work, in the mono face. Screen readers hear the name as a question, not a run-together
// address.

import Link from 'next/link';

import { SITE } from '@/shared/site';

/**
 * The mark: a token, its options for the next token (a thicker branch is a likelier option), and the one
 * picked, lit. Decoration only. The same drawing is the tab icon, src/app/icon.svg.
 */
function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect className="lit-line" x="2" y="9.5" width="5" height="5" strokeWidth="1.8" />
      <path className="lit-line" d="M7 12C11.5 12 11 5 15.5 5" strokeWidth="2.2" />
      <path className="dim-line" d="M7 12H15.5" strokeWidth="1.8" />
      <path className="dim-line" d="M7 12C11.5 12 11 19 15.5 19" strokeWidth="1.4" />
      <rect className="lit-fill" x="15.5" y="2.5" width="5.5" height="5" />
      <rect className="dim-line" x="16" y="9.75" width="4.5" height="4.5" strokeWidth="1.7" />
      <rect className="dim-line" x="16" y="16.75" width="4.5" height="4.5" strokeWidth="1.7" />
    </svg>
  );
}

function Wordmark() {
  return (
    <>
      <Mark />
      <span aria-hidden="true">
        {SITE.domain.replace(/\.work$/, '')}
        <span className="brand-tld">.work</span>
      </span>
      <span className="sr-only">{SITE.name}</span>
    </>
  );
}

/** A link home, or plain text on the landing page itself. */
export function Brand({ link = true }: { link?: boolean }) {
  return link ? (
    <Link href="/" className="brand">
      <Wordmark />
    </Link>
  ) : (
    <span className="brand">
      <Wordmark />
    </span>
  );
}
