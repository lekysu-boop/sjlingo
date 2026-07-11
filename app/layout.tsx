/* eslint-disable @next/next/no-page-custom-font -- App Router에는 pages/_document가 없어 루트 layout에서 전역 폰트를 선언합니다. */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/hooks/useSession';
import './globals.css';

export const metadata: Metadata = {
  title: '암기 마스터',
  description: '암기코드·기출문제 반복 학습 플랫폼',
};

// 모바일 기기 화면 폭에 맞춰 렌더링 (반응형의 전제 조건)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // 아이폰 노치·홈바 영역까지 배경이 차게
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
