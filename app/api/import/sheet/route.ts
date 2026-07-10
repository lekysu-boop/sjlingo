import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dedupeKeywords, dedupeExams } from '@/lib/dedupe';

export const runtime = 'nodejs';

// ============================================================
//  구글 시트 → 서버사이드(HTTPS)로 CSV를 가져와 파싱해 저장.
//  프로토타입과 동일하게 "열 순서"가 아니라 "열 이름(헤더)"으로 매칭합니다.
//  서버에서 fetch 하므로 브라우저 CORS 제약이 없습니다.
//  (단, 시트는 '링크가 있는 모든 사용자 보기' 이상으로 공개되어야 합니다.)
// ============================================================

function toCsvUrl(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const g = url.match(/[#&?]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&gid=${g ? g[1] : '0'}`;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// 헤더 이름에 키워드가 포함된 열의 인덱스 찾기 (순서 무관)
function colIdx(header: string[], keys: string[]): number {
  return header.findIndex((h) => {
    const n = (h || '').replace(/\s/g, '').toLowerCase();
    return keys.some((k) => n.includes(k.toLowerCase()));
  });
}

// 시트 맨 위에 제목·안내문 등 머리말 행이 섞여 있을 수 있어서,
// 실제 열 이름이 있는 행을 앞쪽 몇 줄에서 찾아낸다 (없으면 1행으로 가정).
// 설명 문구 한 칸에 "암기코드" 같은 단어가 우연히 섞여 오탐하는 것을 막기 위해,
// 서로 다른 열 2개 이상이 각각 별개의 칸에서 매칭되는 행만 헤더로 인정한다.
function findHeaderRow(rows: string[][], keyGroups: string[][]): number {
  const limit = Math.min(rows.length, 10);
  for (let i = 0; i < limit; i++) {
    const idxs = keyGroups.map((keys) => colIdx(rows[i], keys));
    if (idxs.every((idx) => idx >= 0) && new Set(idxs).size === idxs.length) return i;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  const { userId, subjectId, kind, url } = await req.json();
  if (!userId || !subjectId || !url)
    return NextResponse.json({ error: 'userId, subjectId, url 필요' }, { status: 400 });

  const csvUrl = toCsvUrl(url);
  if (!csvUrl) return NextResponse.json({ error: '올바른 구글 시트 링크가 아니에요.' }, { status: 400 });

  let rows: string[][];
  try {
    const res = await fetch(csvUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = parseCSV(await res.text());
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
      ['암기코드', '코드', 'code'],
      ['핵심개념', '개념', 'concept'],
    ]);
    const header = rows[headerIdx];
    const iE = colIdx(header, ['시대', '주제', '분류', 'era']);
    const iC = colIdx(header, ['암기코드', '코드', 'code']);
    const iK = colIdx(header, ['핵심개념', '개념', 'concept']);
    const iP = colIdx(header, ['연상', '기법', '매칭', '원리', '설명', 'principle']);
    const iD = colIdx(header, ['회차', '강의', 'day']);
    const items = rows.slice(headerIdx + 1).map((r) => ({
      era: g(r, iE >= 0 ? iE : 0, '기타'),
      code: g(r, iC >= 0 ? iC : 1),
      concept: g(r, iK >= 0 ? iK : 2),
      principle: g(r, iP >= 0 ? iP : 3),
      day: g(r, iD),
    })).filter((k) => k.code && k.concept);

    const { data: existing } = await db.from('keywords').select('code')
      .eq('owner_id', userId).eq('subject_id', subjectId);
    const { toInsert, added, skipped } = dedupeKeywords(existing || [], items);
    if (toInsert.length) {
      const rows2 = toInsert.map((it) => ({ ...it, owner_id: userId, subject_id: subjectId }));
      await db.from('keywords').insert(rows2);
    }
    return NextResponse.json({ kind, added, skipped, parsed: items.length });
  }

  // kind === 'exam'
  const headerIdx = findHeaderRow(rows, [
    ['문제', '질문', 'question'],
    ['정답', 'answer'],
  ]);
  const header = rows[headerIdx];
  const iE = colIdx(header, ['시대', '범위', 'era']);
  const iQ = colIdx(header, ['문제', '질문', 'question']);
  const iA = colIdx(header, ['정답', 'answer']);
  const iX = colIdx(header, ['해설', '풀이', 'explain']);
  const optIdx: number[] = [];
  header.forEach((h, i) => { if (/보기|선택|opt|choice/i.test((h || '').replace(/\s/g, ''))) optIdx.push(i); });

  const items = rows.slice(headerIdx + 1).map((r) => {
    const options = (optIdx.length ? optIdx : [2, 3, 4, 5]).map((i) => g(r, i)).filter((x) => x !== '');
    const ansRaw = g(r, iA >= 0 ? iA : 2 + options.length, '1');
    let answer = parseInt(ansRaw);
    answer = isNaN(answer) ? options.findIndex((o) => o === ansRaw) : answer - 1;
    if (answer < 0 || answer >= options.length) answer = 0;
    return { era: g(r, iE >= 0 ? iE : 0, '기타'), question: g(r, iQ >= 0 ? iQ : 1), options, answer, explain: g(r, iX) };
  }).filter((q) => q.question && q.options.length >= 2);

  const { data: existing } = await db.from('exam_questions').select('question')
    .eq('owner_id', userId).eq('subject_id', subjectId);
  const { toInsert, added, skipped } = dedupeExams(existing || [], items);
  if (toInsert.length) {
    const rows2 = toInsert.map((it) => ({ ...it, owner_id: userId, subject_id: subjectId }));
    await db.from('exam_questions').insert(rows2);
  }
  return NextResponse.json({ kind, added, skipped, parsed: items.length });
}
