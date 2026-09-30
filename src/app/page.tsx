import Link from 'next/link';

// Placeholder until the Phase 2 landing page.
export default function Home() {
  return (
    <main className="home" id="main">
      <h1 className="font-mono text-3xl tracking-widest uppercase">Token by Token</h1>
      <p className="max-w-prose">
        Ask an AI model a question, then look at how its reply was made: every token, the alternatives the model
        scored at each step, and exactly what this site sent. The step-by-step walkthrough is coming soon.
      </p>
      <p>
        <Link href="/chat" className="btn btn-primary">
          Ask your own question
        </Link>
      </p>
      <p className="muted">
        <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
