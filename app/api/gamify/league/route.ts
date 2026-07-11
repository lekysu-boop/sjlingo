import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { weekStart } from '@/lib/gamify';
import type { LeagueEntry } from '@/lib/types';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/gamify/league?userId=... — 이번 주 리더보드
// 순위 점수 = 공부시간(분)×3 (제일 크게 가중) + XP + 과목별 평균 정답률(0~100).
//  - 공부시간: 오래 앉아 공부한 노력 (가장 큰 가중치)
//  - XP      : 맞힌 문제의 양
//  - 평균 정답률: 과목별로 (암기율·정답률)을 평균 낸 뒤 과목끼리 다시 평균 — 질(quality) 보너스
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const db = createAdminClient();
  const ws = weekStart(); // 이번 주 월요일 (YYYY-MM-DD)

  const [{ data: scores }, { data: sessions }] = await Promise.all([
    db.from('league_scores').select('owner_id, xp').eq('week_start', ws),
    db.from('study_sessions').select('owner_id, subject_id, kind, total, correct, duration_sec').gte('created_at', ws),
  ]);

  // 사용자별 집계: XP / 공부시간 / 과목별 세션
  const xpMap = new Map<string, number>();
  (scores || []).forEach((s) => xpMap.set(s.owner_id, s.xp));

  type Sess = { owner_id: string; subject_id: string; kind: string; total: number; correct: number; duration_sec: number };
  const byUser = new Map<string, Sess[]>();
  ((sessions || []) as Sess[]).forEach((s) => {
    const arr = byUser.get(s.owner_id) ?? [];
    arr.push(s);
    byUser.set(s.owner_id, arr);
  });

  const ids = [...new Set([...xpMap.keys(), ...byUser.keys()])];
  const { data: profs } = ids.length
    ? await db.from('profiles').select('id, name, emoji').in('id', ids)
    : { data: [] as any[] };
  const pmap = new Map((profs || []).map((p) => [p.id, p]));

  // 세션 목록 → 가중평균 정답률(%) (총 문항 수 가중)
  const wAvg = (list: { total: number; correct: number }[]): number | null => {
    const t = list.reduce((a, s) => a + s.total, 0);
    return t > 0 ? (list.reduce((a, s) => a + s.correct, 0) / t) * 100 : null;
  };

  const ranked = ids.map((id) => {
    const sess = byUser.get(id) ?? [];
    const studyMin = Math.round(sess.reduce((a, s) => a + s.duration_sec, 0) / 60);

    // 과목별 평균 점수: 과목마다 (키워드 암기율 + 기출 정답률)/2 → 과목끼리 평균
    const subjectIds = [...new Set(sess.map((s) => s.subject_id))];
    const perSubject = subjectIds.map((sid) => {
      const mine = sess.filter((s) => s.subject_id === sid);
      const rates = [wAvg(mine.filter((s) => s.kind === 'kw')), wAvg(mine.filter((s) => s.kind === 'ex'))]
        .filter((r): r is number => r !== null);
      return rates.length ? rates.reduce((a, r) => a + r, 0) / rates.length : 0;
    });
    const quality = perSubject.length
      ? Math.round(perSubject.reduce((a, q) => a + q, 0) / perSubject.length)
      : 0;

    const xp = xpMap.get(id) ?? 0;
    const score = studyMin * 3 + xp + quality;
    return { id, xp, studyMin, quality, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const league: LeagueEntry[] = ranked.map((r, i) => {
    const p = pmap.get(r.id);
    return {
      id: r.id,
      name: p?.name ?? '학습자',
      emoji: p?.emoji ?? '🦊',
      xp: r.xp,
      studyMin: r.studyMin,
      quality: r.quality,
      score: r.score,
      rank: i + 1,
      me: r.id === userId,
      promote: i < 3,
    };
  });

  return NextResponse.json(league);
}
