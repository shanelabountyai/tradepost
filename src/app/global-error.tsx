'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        {error.digest && <p>Error id: {error.digest}</p>}
      </body>
    </html>
  );
}
