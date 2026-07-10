import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// POST /api/progress/keyword — 키워드 학습 결과 기록
// body: { userId, keywordId, known: boolean }
export async function POST(req: NextRequest) {
  const { userId, keywordId, known } = await req.json();
  if (!userId || !keywordId || typeof known !== 'boolean')
    return NextResponse.json({ error: 'userId, keywordId, known 필요' }, { status: 400 });

  const db = createAdminClient();

  // 상태 upsert: known이면 wrong 해제, 모르면 wrong 표시(복습함 대상)
  const { error: e1 } = await db.from('keyword_progress').upsert(
    { owner_id: userId, keyword_id: keywordId, known, wrong: !known, updated_at: new Date().toISOString() },
    { onConflict: 'owner_id,keyword_id' }
  );
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // 월간 학습량 이벤트 적재
  const { error: e2 } = await db.from('keyword_events').insert({ owner_id: userId, known });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
