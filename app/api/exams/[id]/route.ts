import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { clampImportance } from '@/lib/importance';

export const runtime = 'nodejs';

// PATCH /api/exams/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.era === 'string') patch.era = body.era.trim() || '기타';
  if (typeof body.question === 'string') patch.question = body.question.trim();
  if (Array.isArray(body.options))
    patch.options = body.options.map((o: string) => (o || '').trim()).filter((o: string) => o !== '');
  if (typeof body.answer === 'number') patch.answer = body.answer;
  if (typeof body.explain === 'string') patch.explain = body.explain.trim();
  if (body.importance !== undefined) patch.importance = clampImportance(body.importance);

  const db = createAdminClient();
  const { data, error } = await db
    .from('exam_questions')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/exams/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = createAdminClient();
  const { error } = await db.from('exam_questions').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
