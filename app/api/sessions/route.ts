import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// POST /api/sessions — 학습 세션 1회 기록 (공부시간·정답률의 원천 데이터)
//  body: { userId, subjectId, kind: 'kw'|'ex', total, correct, durationSec }
export async function POST(req: NextRequest) {
  const { userId, subjectId, kind, total = 0, correct = 0, durationSec = 0 } = await req.json();
  if (!userId || !subjectId || !['kw', 'ex'].includes(kind))
    return NextResponse.json({ error: 'userId, subjectId, kind 필요' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('study_sessions').insert({
    owner_id: userId,
    subject_id: subjectId,
    kind,
    total: Math.max(0, Math.round(total)),
    correct: Math.max(0, Math.round(correct)),
    // 비정상적으로 긴 값(탭 방치 등)은 3시간으로 상한
    duration_sec: Math.min(Math.max(0, Math.round(durationSec)), 3 * 3600),
  });
  // 테이블 미생성(마이그레이션 전) 등 오류는 학습 흐름을 막지 않도록 메시지만 전달
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  return NextResponse.json({ ok: true });
}
