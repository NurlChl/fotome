import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import ConditionalLayout from '@/components/ConditionalLayout';

export const metadata: Metadata = {
  title: {
    default: 'FotoMe — Find Your Photos with AI Face Recognition',
    template: '%s | FotoMe',
  },
  description:
    'FotoMe is an AI-powered photo marketplace that helps you find your event photos using face recognition. Upload a selfie and discover your photos from marathons, concerts, weddings, and more.',
  keywords: [
    'face recognition',
    'photo marketplace',
    'event photos',
    'AI photo search',
    'face search',
    'marathon photos',
    'concert photos',
  ],
  authors: [{ name: 'FotoMe' }],
  openGraph: {
    title: 'FotoMe — Find Your Photos with AI Face Recognition',
    description:
      'Discover your event photos using AI face recognition. Fast, secure, and accurate.',
    type: 'website',
    locale: 'id_ID',
    siteName: 'FotoMe',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  if (saved === 'light' || (!saved && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100vh',
            }}
          >
            <ConditionalLayout>{children}</ConditionalLayout>
          </div>
        </Providers>
      </body>
    </html>
  );
}
