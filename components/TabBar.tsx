'use client';
import { useRouter } from 'next/navigation';

// 하단 공통 탭바 — 모든 주요 화면(홈/리그/통계/데이터)에서 같은 구성을 쓴다.
// 화면마다 탭 개수가 달라 길을 잃던 문제를 없애기 위해 한 곳에서 관리한다.
const TABS = [
  { key: 'home', icon: '🏠', label: '홈', path: '/home' },
  { key: 'league', icon: '🏆', label: '리그', path: '/league' },
  { key: 'stats', icon: '📊', label: '통계', path: '/stats' },
  { key: 'data', icon: '🗄️', label: '데이터', path: '/data' },
] as const;

export type TabKey = typeof TABS[number]['key'];

export function TabBar({ active }: { active: TabKey }) {
  const router = useRouter();
  return (
    <nav className="app-tabbar">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => !isActive && router.push(t.path)}
            style={{
              background: 'none', border: 'none', cursor: isActive ? 'default' : 'pointer',
              fontSize: 12.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.7,
              color: isActive ? '#2563eb' : '#94a3b8',
            }}
          >
            {t.icon}<br />{t.label}
          </button>
        );
      })}
    </nav>
  );
}
