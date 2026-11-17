import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '史萊姆捏捏工坊',
  description: '走進月光谷，採集、加工、直播你的酥脆捏捏',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', userScalable: false, themeColor: '#0a0e14' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
