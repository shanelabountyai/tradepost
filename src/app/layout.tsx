// public: the root shell; renders no data
export const metadata = { title: 'SaaS Foundation' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
