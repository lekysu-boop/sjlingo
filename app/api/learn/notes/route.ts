import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
//  app/api/learn/notes/route.ts  —  SPA 학습용 샘플 API
// ----------------------------------------------------------------------------
//  이 파일 이름이 정확히 "route.ts"인 것 자체가 의미가 있습니다. Next.js(App
//  Router)는 app/ 폴더 아래에서 "route.ts"라는 정해진(예약된) 이름의 파일을
//  발견하면 "여기는 화면이 아니라 API다"라고 인식합니다. 그리고 그 안에서
//  export한 함수 이름이 HTTP 메서드 이름(GET/POST/PATCH/DELETE)과 똑같으면,
//  그 메서드로 요청이 올 때 Next.js가 알아서 그 함수를 호출해줍니다.
//  (Spring의 @GetMapping/@PostMapping이 붙은 메서드를 자동으로 매칭해주는 것과 같은 원리 —
//   여기서는 애너테이션 대신 "파일 위치 + 함수 이름"이 그 역할을 합니다.)
//
//  이 폴더의 URL: app/api/learn/notes/route.ts → /api/learn/notes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store'; // 캐시로 옛날 응답이 나오지 않게 강제

// ----------------------------------------------------------------------------
//  "DB" 대신 서버 메모리에만 저장하는 아주 단순한 저장소입니다.
//  다른 API들(app/api/keywords/route.ts 등)은 Supabase(PostgreSQL)에 저장해서
//  서버가 꺼졌다 켜져도(=배포, 재시작) 데이터가 남습니다. 여기는 학습용이라
//  일부러 배열 변수 하나로만 만들었습니다 — 즉 "npm run dev"를 껐다 켜면
//  이 목록은 초기화됩니다. (진짜 앱이라면 이렇게 만들면 안 됩니다 — 재시작마다
//  데이터가 날아가니까요. DB에 저장해야 영구 보존됩니다.)
// ----------------------------------------------------------------------------
interface Note { id: number; text: string; createdAt: string }
let notes: Note[] = [];
let nextId = 1;

// 실제 네트워크/DB 조회는 "즉시" 끝나지 않고 시간이 걸립니다. 그 느낌을 체감할 수
// 있도록 일부러 지연을 흉내 냅니다. new Promise(...)를 직접 만드는 예시이기도
// 합니다 — Promise는 "지금 당장 값이 없고, 나중에(resolve가 호출되면) 값이
// 준비되는 상자"입니다. setTimeout이 다 지나면 resolve()를 호출해서 이 Promise를
// "완료" 상태로 바꿔줍니다.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ----------------------------------------------------------------------------
//  GET /api/learn/notes — 저장된 메모 전체를 반환
//  함수 앞에 async가 붙은 이유: 안에서 await delay(...)를 쓰기 때문입니다.
//  async 함수는 "이 함수는 결과가 나오기까지 시간이 걸릴 수 있다"는 표시이고,
//  실제로 이 함수를 호출하는 쪽(Next.js 내부)도 await로 기다려서 결과를 받습니다.
// ----------------------------------------------------------------------------
export async function GET() {
  await delay(400); // "DB 조회 중..."을 흉내. 프론트에서 로딩 스피너가 보이는 이유가 이것.
  return NextResponse.json(notes);
}

// ----------------------------------------------------------------------------
//  POST /api/learn/notes — 메모 추가. 요청 body: { text: string }
// ----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // req.json() 도 Promise를 반환합니다 (요청 본문을 다 읽어서 JS 객체로 바꾸는 데
  // 시간이 걸리기 때문). 그래서 await 로 기다렸다가 결과를 받습니다.
  const body = await req.json();
  const text = (body?.text ?? '').trim();

  if (!text) {
    // 400 = "네가 보낸 요청 자체가 잘못됐다" (서버 탓이 아니라 요청 탓)
    return NextResponse.json({ error: '내용을 입력하세요' }, { status: 400 });
  }

  await delay(400); // "DB에 insert 하는 중..."을 흉내
  const note: Note = { id: nextId++, text, createdAt: new Date().toISOString() };
  notes.unshift(note); // 배열 맨 앞에 추가 → 최신 글이 위로
  return NextResponse.json(note, { status: 201 }); // 201 = "새로 만들어졌다"
}

// ----------------------------------------------------------------------------
//  DELETE /api/learn/notes?id=3 — 메모 하나 삭제
//  쿼리스트링(?id=3)은 req.nextUrl.searchParams로 읽습니다.
// ----------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get('id'));
  await delay(200);
  notes = notes.filter((n) => n.id !== id);
  return NextResponse.json({ ok: true });
}
