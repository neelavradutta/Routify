import type { Metadata } from 'next';
import { IBM_Plex_Sans, Source_Serif_4 } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

const serif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Routify — safer walking in India',
  description: 'Pick a faster, mixed, or safer walk through Indian cities.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              fontSize: '13px',
              boxShadow: '0 16px 40px -20px rgba(101, 163, 13, 0.4)',
            },
          }}
        />
      </body>
    </html>
  );
}
