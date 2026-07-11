import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// POST /api/cheers — 응원 보내기 { toId, fromId }
// 규칙:
//  - 보내는 사람(fromId)이 반드시 있어야 함 (로그인한 사용자만 응원 가능)
//  - 자기 자신은 응원할 수 없음
//  - 같은 상대에게는 하루 2번까지만 (여러 명에게는 각각 2번씩 가능)
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.toId) return NextResponse.json({ error: 'toId 필요' }, { status: 400 });
  if (!body.fromId) return NextResponse.json({ error: '로그인 후에 응원할 수 있어요' }, { status: 400 });
  if (body.fromId === body.toId)
    return NextResponse.json({ error: '자신에게는 응원할 수 없어요 😅' }, { status: 400 });

  const db = createAdminClient();

  // 오늘(UTC 기준 날짜) 이 사람이 이 상대에게 보낸 응원 수 확인
  const todayStart = new Date().toISOString().slice(0, 10); // YYYY-MM-DD 00:00
  const { count: sentToday } = await db
    .from('cheers')
    .select('*', { count: 'exact', head: true })
    .eq('from_id', body.fromId)
    .eq('to_id', body.toId)
    .gte('created_at', todayStart);
  if ((sentToday ?? 0) >= 2)
    return NextResponse.json({ error: '이 친구에게는 오늘 이미 2번 응원했어요! 내일 또 응원해 주세요 👏' }, { status: 429 });

  const { error } = await db
    .from('cheers')
    .insert({ to_id: body.toId, from_id: body.fromId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await db
    .from('cheers')
    .select('*', { count: 'exact', head: true })
    .eq('to_id', body.toId);
  return NextResponse.json({ cheers: count ?? 0 }, { status: 201 });
}
