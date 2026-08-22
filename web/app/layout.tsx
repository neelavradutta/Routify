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
              background: '#F7F1E8',
              color: '#1F1A16',
              border: '1px solid #D9D0C3',
              borderRadius: '8px',
              fontSize: '13px',
              boxShadow: '0 6px 20px -12px rgba(31, 26, 22, 0.35)',
            },
          }}
        />
      </body>
    </html>
  );
}
