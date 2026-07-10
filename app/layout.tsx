import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/hooks/useSession';

export const metadata: Metadata = {
  title: '암기 마스터',
  description: '암기코드·기출문제 반복 학습 플랫폼',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, fontFamily: "'Noto Sans KR', sans-serif", background: '#e5e9f0' }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
