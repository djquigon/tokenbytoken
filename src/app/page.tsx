import Link from 'next/link';

import rain from '@/content/rain-tokens.json';
import { DecodeText } from '@/components/effects/DecodeText';
import { Term } from '@/components/glossary/Term';
import { RainCanvas } from '@/components/effects/TokenRain';
import { LabelChip } from '@/components/provenance/ProvBadge';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { ArrowRightIcon, PlayIcon } from '@/components/ui/icons';

import {
    contextRuns,
    heroMoment,
    pickMoment,
    questionPieces,
    recordedAt,
    recordedModel,
} from './landing-data';
import {
    ContextRows,
    MomentRows,
    NextTokenFigure,
    OptionsLegend,
    TokenChips,
} from './landing-graphics';

// The landing page (docs/PLAN.md §1, journey step 1). Static. A header bar, the hero (the pitch beside a
// real next-token moment from the sample), three feature cards built from the sample's real data, the
// label key, and a footer bar. Behind it all falls the token rain: real tokens of the tokenizer this app
// uses, picked at random from thousands of words and numbers. Every block of text sits on a solid panel,
// so the rain never runs behind the words. Settings (in the header, src/components/site/) holds the
// Effects switch that stops it (WCAG 2.2.2).

export default function Home() {
    return (
        <>
            <RainCanvas pool={rain.tokens} />
            <div className="site-page landing-page">
                <SiteHeader home />

                <main className="landing" id="main">
                    <section
                        className="hero landing-card"
                        aria-labelledby="hero-title"
                    >
                        <div className="hero-copy">
                            <p className="eyebrow eyebrow-accent">
                                Under the hood
                            </p>
                            <h1 id="hero-title" className="hero-title">
                                <DecodeText text="Token by Token" />
                            </h1>
                            <p className="hero-subtitle">
                                How a chatbot writes its reply
                            </p>
                            <p className="lede">
                                Ask a real AI model a question. Then step
                                through how its reply was made, one token at a
                                time, using the real data behind it, with every
                                value labeled.
                            </p>
                            <div className="cta">
                                <Link
                                    href="/chat"
                                    className="btn btn-primary btn-large"
                                >
                                    Ask your own question <ArrowRightIcon />
                                </Link>
                                <Link href="/sample" className="btn btn-large">
                                    Replay a sample conversation <PlayIcon />
                                </Link>
                            </div>
                        </div>
                        {heroMoment ? (
                            <NextTokenFigure
                                moment={heroMoment}
                                recordedAt={recordedAt}
                                recordedModel={recordedModel}
                            />
                        ) : null}
                    </section>

                    <section
                        className="features"
                        aria-labelledby="features-title"
                    >
                        <h2 id="features-title" className="section-title">
                            What you&rsquo;ll see
                        </h2>
                        <ol className="feature-grid">
                            <li className="feature-card landing-card">
                                <h3>Tokens</h3>
                                <p>
                                    Text is split into{' '}
                                    <Term id="token">tokens</Term>: often a
                                    whole word with its leading space, sometimes
                                    a piece of one, like building blocks of
                                    text. AI services count tokens, not words: a
                                    model can take in{' '}
                                    <Term id="context-limit">
                                        only so many at once
                                    </Term>
                                    , each reply is capped at a set number, and
                                    every request is priced by the token.
                                </p>
                                <div className="feature-demo">
                                    <TokenChips
                                        tokens={questionPieces}
                                        label="The sample's first question, as tokens"
                                        ids
                                    />
                                    <p className="figure-legend">
                                        <span>
                                            <LabelChip kind="calculated" />{' '}
                                            tokens and IDs, split by this
                                            app&rsquo;s tokenizer
                                        </span>
                                    </p>
                                </div>
                                <Link href="/sample" className="feature-link">
                                    See it in the sample <ArrowRightIcon />
                                </Link>
                            </li>
                            <li className="feature-card landing-card">
                                <h3>A weighted random pick</h3>
                                <p>
                                    At every step the model{' '}
                                    <Term id="score">scores</Term> the options
                                    for the next token. One is{' '}
                                    <Term id="sampling">
                                        picked at random, weighted by those
                                        scores
                                    </Term>
                                    , like a raffle where likelier options hold
                                    more tickets, so the top option doesn&rsquo;t
                                    always win.
                                </p>
                                {pickMoment ? (
                                    <div className="feature-demo">
                                        <MomentRows moment={pickMoment} />
                                        <p className="figure-legend">
                                            <OptionsLegend />
                                        </p>
                                    </div>
                                ) : null}
                                <Link href="/sample" className="feature-link">
                                    See it in the sample <ArrowRightIcon />
                                </Link>
                            </li>
                            <li className="feature-card landing-card">
                                <h3>Context, not memory</h3>
                                <p>
                                    With each message, this app sends the{' '}
                                    <Term id="context">conversation so far</Term>{' '}
                                    again, with its own{' '}
                                    <Term id="instructions">instructions</Term>,
                                    like handing over the whole transcript each
                                    time. Chatting doesn&rsquo;t change the
                                    model.
                                </p>
                                <div className="feature-demo">
                                    <ContextRows
                                        runs={contextRuns}
                                        label="Everything the sample's second request carried"
                                    />
                                    <p className="figure-legend">
                                        <span>
                                            <LabelChip kind="recorded" /> text,
                                            sent by this app
                                        </span>
                                        <span>
                                            <LabelChip kind="calculated" />{' '}
                                            token counts
                                        </span>
                                    </p>
                                </div>
                                <Link href="/sample" className="feature-link">
                                    See it in the sample <ArrowRightIcon />
                                </Link>
                            </li>
                        </ol>
                    </section>

                    <section
                        className="landing-card real-key"
                        aria-labelledby="real-title"
                    >
                        <h2 id="real-title" className="section-title">
                            What&rsquo;s real here
                        </h2>
                        <p>
                            Every value carries one of four labels, always as a
                            word, never just a color:
                        </p>
                        <dl className="label-key">
                            <div>
                                <dt>
                                    <LabelChip kind="recorded" />
                                </dt>
                                <dd>
                                    Sent, done, or measured by this app, or
                                    reported by OpenAI, for your conversation.
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    <LabelChip kind="calculated" />
                                </dt>
                                <dd>
                                    Computed here from recorded values, with the
                                    method named.
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    <LabelChip kind="reference" />
                                </dt>
                                <dd>
                                    Documented facts, such as the model&rsquo;s
                                    context limit, with a source and a date.
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    <LabelChip kind="example" />
                                </dt>
                                <dd>
                                    A teaching drawing, not measured from the
                                    model. Views of the network&rsquo;s insides
                                    are always examples: OpenAI hasn&rsquo;t
                                    published the design of its hosted models.
                                </dd>
                            </div>
                        </dl>
                        <p className="muted">
                            A <strong>What-if</strong> tag marks anything
                            simulated on the page. The model wasn&rsquo;t asked
                            again.
                        </p>
                    </section>
                </main>

                <SiteFooter />
            </div>
        </>
    );
}
