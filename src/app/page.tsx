import Link from 'next/link';

import rain from '@/content/rain-tokens.json';
import { DecodeText } from '@/components/effects/DecodeText';
import { RainCanvas, RainControls, RainProvider } from '@/components/effects/TokenRain';
import { LabelChip } from '@/components/provenance/ProvBadge';

// The landing page (docs/PLAN.md §1, journey step 1). Static. Behind it falls the token rain: real tokens
// of the tokenizer this app uses, picked at random from thousands of words and numbers. Every block of
// text sits on a solid panel, so the rain never runs behind the words.

export default function Home() {
  return (
    <RainProvider>
      <RainCanvas pool={rain.tokens} />
      <main className="landing" id="main">
        <section className="hero landing-card" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">How a chatbot writes its reply</p>
            <h1 id="hero-title" className="hero-title">
              <DecodeText text="Token by Token" />
            </h1>
            <p className="lede">
              Ask a real AI model a question. Then step through how its reply was made, one token at a time, using the real data behind it, with
              every value labeled.
            </p>
            <div className="cta">
              <Link href="/chat" className="btn btn-primary">
                Ask your own question
              </Link>
              <Link href="/sample" className="btn">
                Replay a sample conversation
              </Link>
            </div>
            <p className="muted small">No sign-in. The sample replays a recorded conversation and sends nothing.</p>
            <RainControls>
              Falling behind this page: real tokens of the tokenizer this app uses, picked at random from thousands of words and numbers.
            </RainControls>
          </div>
        </section>

        <section className="landing-section landing-card" aria-labelledby="learn-title">
          <h2 id="learn-title">You&rsquo;ll see</h2>
          <ul className="learn-list">
            <li>
              <strong>One token at a time.</strong> A reply is written in small pieces called tokens. At every step the model scores the options for
              the next one, based on all the text so far.
            </li>
            <li>
              <strong>A weighted random pick.</strong> One option is picked at random, weighted by those scores. That&rsquo;s one reason the same
              question can get different replies.
            </li>
            <li>
              <strong>Text becomes tokens.</strong> How your message is split up, and why limits and prices are counted in tokens.
            </li>
            <li>
              <strong>Context, not memory.</strong> The app sends the conversation again with each message. Chatting doesn&rsquo;t change the model.
            </li>
            <li>
              <strong>Real or example.</strong> Which parts are real data from your conversation, and which are teaching drawings.
            </li>
          </ul>
        </section>

        <section className="landing-section landing-card" aria-labelledby="real-title">
          <h2 id="real-title">What&rsquo;s real here</h2>
          <p>Every value carries one of four labels, always as a word, never just a color:</p>
          <dl className="label-key">
            <div>
              <dt>
                <LabelChip kind="recorded" />
              </dt>
              <dd>Sent, done, or measured by this app, or reported by OpenAI, for your conversation.</dd>
            </div>
            <div>
              <dt>
                <LabelChip kind="calculated" />
              </dt>
              <dd>Computed here from recorded values, with the method named.</dd>
            </div>
            <div>
              <dt>
                <LabelChip kind="reference" />
              </dt>
              <dd>Documented facts, such as the model&rsquo;s context limit, with a source and a date.</dd>
            </div>
            <div>
              <dt>
                <LabelChip kind="example" />
              </dt>
              <dd>
                A teaching drawing, not measured from the model. Views of the network&rsquo;s insides are always examples: OpenAI hasn&rsquo;t
                published the design of its hosted models.
              </dd>
            </div>
          </dl>
          <p className="muted">
            A <strong>What-if</strong> tag marks anything simulated on the page. The model wasn&rsquo;t asked again.
          </p>
        </section>

        <footer className="landing-footer landing-card">
          <p>
            A personal, non-commercial project. Replies come from OpenAI&rsquo;s API, and this site doesn&rsquo;t store your conversations on its servers.{' '}
            <Link href="/privacy">Privacy</Link>
          </p>
        </footer>
      </main>
    </RainProvider>
  );
}
