'use client';

// `digest` is the id Next also writes to the server log; safe to show, unlike the message.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <h1>Something went wrong</h1>
      {error.digest && <p>Error id: {error.digest}</p>}
      <button onClick={reset}>Try again</button>
    </main>
  );
}
