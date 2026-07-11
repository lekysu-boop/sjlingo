import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dedupeKeywords, dedupeExactExams } from '@/lib/dedupe';
import { clampImportance } from '@/lib/importance';
import { findColumn, findHeaderRow, parseCsv, toGoogleSheetCsvUrl } from '@/lib/googleSheet';
import { parseExamSheetRows } from '@/lib/sheetImport';

export const runtime = 'nodejs';

// ============================================================
//  Google Sheet -> CSV -> DTO -> 중복 제거 -> Supabase
// ----------------------------------------------------------------------------
//  브라우저는 이 API에 원본 공유 URL만 보냅니다. 실제 Google 요청은 서버에서 하므로
//  CORS를 피하고, Supabase service_role 키도 브라우저에 노출되지 않습니다.
//  열 "순서"가 아니라 열 "이름"을 찾으므로 사용자가 열을 옮겨도 가져올 수 있습니다.
// ============================================================

export async function POST(req: NextRequest) {
  const { userId, subjectId, kind, url } = await req.json();
  if (!userId || !subjectId || !url)
    return NextResponse.json({ error: 'userId, subjectId, url 필요' }, { status: 400 });
  if (kind !== 'keyword' && kind !== 'exam')
    return NextResponse.json({ error: 'kind는 keyword 또는 exam 이어야 합니다.' }, { status: 400 });

  const csvUrl = toGoogleSheetCsvUrl(url);
  if (!csvUrl) return NextResponse.json({ error: '올바른 구글 시트 링크가 아니에요.' }, { status: 400 });

  let rows: string[][];
  try {
    // 기본데이터 원본이 바뀌면 즉시 반영되도록 Next/HTTP 캐시를 사용하지 않습니다.
    const res = await fetch(csvUrl, { redirect: 'follow', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = parseCsv(await res.text());
    if (rows.length < 2) throw new Error('데이터 행이 없습니다');
  } catch (e: any) {
    return NextResponse.json(
      { error: `불러오기 실패: 시트를 "링크가 있는 모든 사용자"로 공개했는지 확인해 주세요. (${e.message})` },
      { status: 502 }
    );
  }

  const g = (r: string[], idx: number, d = '') => (idx >= 0 && r[idx] != null ? r[idx].trim() : d);
  const db = createAdminClient();

  if (kind === 'keyword') {
    const headerIdx = findHeaderRow(rows, [
      ['암기코드', '코드', 'code', '키워드'],
      ['핵심개념', '개념', 'concept'],
    ]);
    if (headerIdx < 0)
      return NextResponse.json(
        { error: '키워드 헤더를 찾지 못했어요. 암기코드와 핵심 개념 열을 확인해 주세요.' },
        { status: 422 },
      );
    const header = rows[headerIdx];
    const iE = findColumn(header, ['시대', '주제', '분류', 'era']);
    const iC = findColumn(header, ['암기코드', '코드', 'code', '키워드']);
    const iK = findColumn(header, ['핵심개념', '개념', 'concept']);
    const iP = findColumn(header, ['연상', '기법', '매칭', '원리', '설명', 'principle']);
    const iD = findColumn(header, ['회차', '강의', 'day']);
    const iImp = findColumn(header, ['중요도', '중요', 'importance']);
    const items = rows.slice(headerIdx + 1).map((r) => ({
      era: g(r, iE >= 0 ? iE : 0, '기타'),
      code: g(r, iC >= 0 ? iC : 1),
      concept: g(r, iK >= 0 ? iK : 2),
      principle: g(r, iP >= 0 ? iP : 3),
      day: g(r, iD),
      importance: clampImportance(g(r, iImp, '2')), // '상/중/하' 또는 1~3
    })).filter((k) => k.code && k.concept);

    const { data: existing } = await db.from('keywords').select('code')
      .eq('owner_id', userId).eq('subject_id', subjectId);
    const { toInsert, added, skipped } = dedupeKeywords(existing || [], items);
    if (toInsert.length) {
      const rows2 = toInsert.map((it) => ({ ...it, owner_id: userId, subject_id: subjectId }));
      const { error } = await db.from('keywords').insert(rows2);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ kind, added, skipped, parsed: items.length });
  }

  // kind === 'exam': 보기의 '-' 제거와 정답 번호 재매핑은 테스트 가능한 순수 함수에서 처리합니다.
  const parsedExam = parseExamSheetRows(rows);
  if (parsedExam.headerIndex < 0)
    return NextResponse.json(
      { error: '기출문제 헤더를 찾지 못했어요. 문제와 정답 열을 확인해 주세요.' },
      { status: 422 },
    );
  const items = parsedExam.items;

  const { data: existing } = await db.from('exam_questions').select('question')
    .eq('owner_id', userId).eq('subject_id', subjectId);
  const { toInsert, added, skipped } = dedupeExactExams(existing || [], items);
  if (toInsert.length) {
    const rows2 = toInsert.map((it) => ({ ...it, owner_id: userId, subject_id: subjectId }));
    const { error } = await db.from('exam_questions').insert(rows2);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ kind, added, skipped, parsed: items.length });
}
