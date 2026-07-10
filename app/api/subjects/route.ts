import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// GET /api/subjects?userId=... — 사용자의 과목 목록
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('subjects')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/subjects — 과목 추가 { userId, name, emoji, color }
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.userId || !(body.name || '').trim())
    return NextResponse.json({ error: 'userId와 name 필요' }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from('subjects')
    .insert({
      owner_id: body.userId,
      name: body.name.trim(),
      emoji: body.emoji || '📚',
      color: body.color || '#2563eb',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
