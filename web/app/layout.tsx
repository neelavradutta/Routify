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
  title: 'Safe Routes — safety-weighted walking directions',
  description:
    'Pedestrian navigation for central Delhi that weighs lighting, isolation, camera coverage and crime exposure alongside distance and time.',
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
              background: '#F4EEE4',
              color: '#1C1713',
              border: '1px solid #D4C9BA',
              borderRadius: '12px',
              fontSize: '13px',
              boxShadow: '0 12px 32px -16px rgba(28, 23, 19, 0.38)',
            },
          }}
        />
      </body>
    </html>
  );
}
