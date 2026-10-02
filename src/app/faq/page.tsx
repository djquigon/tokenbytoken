import type { Metadata } from 'next';
import Link from 'next/link';

import { LabelChip } from '@/components/provenance/ProvBadge';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { ArrowRightIcon } from '@/components/ui/icons';
import { RichText } from '@/components/walkthrough/RichText';
import { FAQ, FAQ_CHECKED, FAQ_LATEST_CHECK, type FaqEntry } from '@/content/faq';

export const metadata: Metadata = {
  title: 'Questions about AI',
  description:
    'Short, sourced answers to common questions about AI: the black box, “going rogue”, images and video, and how much it really matters.',
};

// The FAQ (ADR 0010). Static. Short answers to common questions, each with the sources it rests on. The
// copy follows the walkthrough's rules (src/content/faq.ts): plain verbs, and every number a labeled value.

function Answer({ entry }: { entry: FaqEntry }) {
  return (
    <article className="faq-item" id={entry.id} aria-labelledby={`${entry.id}-q`}>
      <h3 id={`${entry.id}-q`}>{entry.question}</h3>
      <p className="faq-short">
        <span className="faq-short-label">
          In short<span className="sr-only">:</span>
        </span>
        <RichText text={entry.short} />
      </p>
      <div className="faq-answer">
        {entry.answer.map((paragraph, i) => (
          <p key={i}>
            <RichText text={paragraph} />
          </p>
        ))}
      </div>
      {entry.timeline ? (
        <ol className="faq-timeline" aria-label="Milestones, oldest first">
          {entry.timeline.map((m) => (
            <li key={`${m.when} ${m.source.url}`}>
              <time dateTime={m.when} className="faq-timeline-when">
                {m.when.slice(0, 4)}
              </time>
              <p className="faq-timeline-what">
                <RichText text={m.what} />{' '}
                <a href={m.source.url} rel="noopener noreferrer" className="faq-timeline-source">
                  {m.source.by}
                </a>
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      {entry.see ? (
        <Link href={entry.see.href} className="faq-see">
          {entry.see.label} <ArrowRightIcon />
        </Link>
      ) : null}
      <div className="faq-sources">
        <p className="faq-sources-head">
          <LabelChip kind="reference" /> Sources
        </p>
        <ul>
          {entry.sources.map((s) => (
            <li key={s.url}>
              {s.by},{' '}
              <a href={s.url} rel="noopener noreferrer">
                {s.title}
              </a>
              {s.venue ? `, ${s.venue}` : ''}
              {s.published ? (
                <>
                  {' '}
                  (<time dateTime={s.published}>{s.published}</time>)
                </>
              ) : s.updated ? (
                <>
                  {' '}
                  (updated <time dateTime={s.updated}>{s.updated}</time>)
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function FaqPage() {
  return (
    <div className="site-page">
      <SiteHeader current="/faq" />
      <main className="faq" id="main">
        <header className="faq-intro">
          <p className="eyebrow eyebrow-accent">Questions</p>
          <h1>Questions people ask about AI</h1>
          <p className="lede">
            Short, plain answers to common questions about AI chatbots and the models behind them. Each answer lists the sources it rests on,
            and every number from them is labeled, like everything else on this site.
          </p>
          <p className="faq-checked">
            <LabelChip kind="reference" /> Sources checked <time dateTime={FAQ_CHECKED}>{FAQ_CHECKED}</time> to{' '}
            <time dateTime={FAQ_LATEST_CHECK}>{FAQ_LATEST_CHECK}</time>
          </p>
        </header>
        <div className="faq-layout">
          <nav className="faq-toc" aria-labelledby="faq-toc-title">
            <h2 id="faq-toc-title" className="section-title">
              On this page
            </h2>
            {FAQ.map((section) => (
              <div key={section.id} className="faq-toc-group">
                <p>{section.title}</p>
                <ul>
                  {section.entries.map((e) => (
                    <li key={e.id}>
                      <a href={`#${e.id}`}>{e.question}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="faq-sections">
            {FAQ.map((section) => (
              <section key={section.id} className="faq-section" aria-labelledby={`${section.id}-title`}>
                <h2 id={`${section.id}-title`} className="section-title">
                  {section.title}
                </h2>
                {section.entries.map((e) => (
                  <Answer key={e.id} entry={e} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter current="/faq" />
    </div>
  );
}
