import './globals.css';
import { SiteHeader } from './header';

export const metadata = { title: { default: 'Tradepost', template: '%s · Tradepost' } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* root app layout, so this loads on every page; the rule is written for pages/_document */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,600;6..72,700&family=IBM+Plex+Mono:wght@500&display=swap"
        />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
