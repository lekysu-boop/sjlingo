import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// PATCH /api/keywords/:id — 키워드 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: Record<string, string> = {};
  for (const k of ['era', 'code', 'concept', 'principle', 'day'] as const) {
    if (typeof body[k] === 'string') patch[k] = body[k].trim();
  }
  if (patch.code === '' ) return NextResponse.json({ error: '암기코드는 필수' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('keywords')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/keywords/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = createAdminClient();
  const { error } = await db.from('keywords').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
