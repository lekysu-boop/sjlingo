import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// POST /api/cheers — 응원 보내기 { toId, fromId? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.toId) return NextResponse.json({ error: 'toId 필요' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from('cheers')
    .insert({ to_id: body.toId, from_id: body.fromId ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await db
    .from('cheers')
    .select('*', { count: 'exact', head: true })
    .eq('to_id', body.toId);
  return NextResponse.json({ cheers: count ?? 0 }, { status: 201 });
}
