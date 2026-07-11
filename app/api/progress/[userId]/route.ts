import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MonthlyStat, SubjectStat, UserProgress } from '@/lib/types';

export const runtime = 'nodejs';
// Supabase(내부적으로 fetch 사용) 응답을 Next.js가 자동 캐싱하지 않도록 강제.
// 이게 없으면 같은 조회가 예전 결과로 고정되어, DB가 바뀌어도 화면에 반영되지 않는다.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET /api/progress/:userId — 진도율·월간·응원 집계
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  // 이 라우트는 요청 객체(searchParams 등)를 읽지 않고 동적 경로 파라미터만 쓰기 때문에,
  // 위 dynamic/fetchCache 설정만으로는 캐시를 안 타는 경우가 있어 noStore()로 확실히 막는다.
  noStore();
  const userId = params.userId;
  const db = createAdminClient();

  // 키워드 암기율: 전체 키워드 대비 known=true 개수
  const [{ count: totalKw }, { count: known }, attempts, kwEvents, { count: cheers }, sessions, subjects] =
    await Promise.all([
      db.from('keywords').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
      db.from('keyword_progress').select('*', { count: 'exact', head: true }).eq('owner_id', userId).eq('known', true),
      db.from('exam_attempts').select('correct, created_at').eq('owner_id', userId),
      db.from('keyword_events').select('created_at').eq('owner_id', userId),
      db.from('cheers').select('*', { count: 'exact', head: true }).eq('to_id', userId),
      // 학습 세션(공부시간·가중평균의 원천). 테이블 미생성 시 data=null 로 조용히 넘어간다.
      db.from('study_sessions').select('subject_id, kind, total, correct, duration_sec').eq('owner_id', userId),
      db.from('subjects').select('id, name, emoji').eq('owner_id', userId),
    ]);

  const exAnswered = attempts.data?.length ?? 0;
  const exCorrect = attempts.data?.filter((a) => a.correct).length ?? 0;

  // ---- 세션 기반 가중평균 ----
  // 여러 번 학습하면 세션 크기(total)를 가중치로 평균: sum(correct)/sum(total).
  // 30문항 세션이 5문항 세션보다 평균에 6배 크게 반영된다.
  const sess = sessions.data ?? [];
  const wAvg = (list: typeof sess) => {
    const t = list.reduce((a, s) => a + s.total, 0);
    return t > 0 ? Math.round((list.reduce((a, s) => a + s.correct, 0) / t) * 100) : null;
  };
  const kwSessRate = wAvg(sess.filter((s) => s.kind === 'kw'));
  const exSessRate = wAvg(sess.filter((s) => s.kind === 'ex'));
  const studyMin = Math.round(sess.reduce((a, s) => a + s.duration_sec, 0) / 60);

  // 세션 기록이 있으면 가중평균을, 없으면 기존 상태 기반 비율을 쓴다 (하위 호환)
  const kwRate = kwSessRate ?? (totalKw ? Math.round(((known ?? 0) / totalKw) * 100) : 0);
  const exRate = exSessRate ?? (exAnswered ? Math.round((exCorrect / exAnswered) * 100) : 0);
  let overall = 0;
  if (kwRate && exRate) overall = Math.round((kwRate + exRate) / 2);
  else overall = kwRate || exRate;

  // ---- 과목별 통계 ----
  // XP·코인은 전역 누적값이라 과목별 실측이 없어, 세션 기록으로 환산한다:
  //   XP = 정답 수 × 10 (기본 XP 기준), 코인 = 공부시간 분 × 1 (시간 보상 기준)
  const bySubject: SubjectStat[] = (subjects.data ?? []).map((sub) => {
    const mine = sess.filter((s) => s.subject_id === sub.id);
    const min = Math.round(mine.reduce((a, s) => a + s.duration_sec, 0) / 60);
    return {
      id: sub.id, name: sub.name, emoji: sub.emoji,
      kwRate: wAvg(mine.filter((s) => s.kind === 'kw')),
      exRate: wAvg(mine.filter((s) => s.kind === 'ex')),
      studyMin: min,
      xp: mine.reduce((a, s) => a + s.correct, 0) * 10,
      coins: min,
      sessions: mine.length,
    };
  }).filter((s) => s.sessions > 0 || (subjects.data ?? []).length <= 3); // 기록 없는 과목은 과목이 많을 때만 숨김

  // 월간 집계 (최근 6개월)
  const buckets: Record<string, { kw: number; exA: number; exC: number }> = {};
  const bump = (iso: string, key: 'kw' | 'exA' | 'exC', n = 1) => {
    const m = iso.slice(0, 7);
    (buckets[m] ??= { kw: 0, exA: 0, exC: 0 })[key] += n;
  };
  kwEvents.data?.forEach((e) => bump(e.created_at, 'kw'));
  attempts.data?.forEach((a) => {
    bump(a.created_at, 'exA');
    if (a.correct) bump(a.created_at, 'exC');
  });
  const months: MonthlyStat[] = Object.keys(buckets)
    .sort()
    .slice(-6)
    .map((k) => {
      const b = buckets[k];
      return { label: `${parseInt(k.slice(5))}월`, kw: b.kw, exA: b.exA, exC: b.exC, total: b.kw + b.exA };
    });

  const result: UserProgress = {
    kwRate, exRate, overall,
    known: known ?? 0, totalKw: totalKw ?? 0,
    exCorrect, exAnswered, cheers: cheers ?? 0,
    studyMin, bySubject, monthly: months,
  };
  return NextResponse.json(result);
}
