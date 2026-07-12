// ============================================================================
//  'use client'
// ----------------------------------------------------------------------------
//  Next.js는 기본적으로 모든 컴포넌트를 "서버"에서 실행합니다(서버 컴포넌트).
//  그런데 이 페이지는 버튼 클릭(이벤트), useState(상태), useEffect(브라우저에서만
//  되는 작업) 을 쓸 겁니다 — 이런 건 브라우저에서 실행돼야 합니다. 그래서 파일
//  맨 위에 이 선언을 써서 "이 파일은 브라우저에서 실행되는 컴포넌트"라고
//  Next.js에게 알려줍니다. 이 줄이 없으면 useState 같은 훅을 쓸 때 에러가 납니다.
// ============================================================================
'use client';

import { useEffect, useRef, useState } from 'react';

// ----------------------------------------------------------------------------
//  interface Note — 데이터의 "모양"을 정의합니다 (Java의 DTO/VO 클래스와 같은 역할).
//  실행 시점에는 사라지고, 코드 작성 시점(컴파일 타임)에만 "이 값에 어떤 필드가
//  있는지"를 TypeScript가 검사하는 데 씁니다.
//  이 모양은 app/api/learn/notes/route.ts 의 Note interface와 반드시 같아야
//  합니다 — 서버가 보내주는 JSON 모양과 프론트가 기대하는 모양이 다르면 안 되니까요.
// ----------------------------------------------------------------------------
interface Note {
  id: number;
  text: string;
  createdAt: string;
}

// ============================================================================
//  PROGRAM 0 (학습용): SPA 개념 + JSX + fetch + async/await 실습 페이지
// ----------------------------------------------------------------------------
//  이 파일 하나로 아래 4가지를 직접 눈으로 확인할 수 있게 만들었습니다.
//    A) "화면이 새로고침 없이 스스로 다시 그려진다" (SPA의 핵심)
//    B) JSX 문법 (onClick={...}, {중괄호로 변수 끼워넣기} 등)
//    C) <form> 제출이 아니라 fetch()로 서버와 JSON을 주고받는 방식
//    D) async / await / Promise 가 실제로 어떤 순서로 동작하는지 (동작 로그로 확인)
//
//  실행 방법: npm run dev 로 개발 서버를 띄운 뒤 브라우저에서
//  http://localhost:3000/learn/spa-demo 접속.
// ============================================================================
export default function SpaDemoPage() {
  // React가 이 SpaDemoPage 함수를 "언제, 왜" 다시 호출하는지 눈으로 보기 위한
  // 카운터입니다. useState가 아니라 useRef를 쓴 이유: useRef는 값이 바뀌어도
  // "화면을 다시 그리라"고 React에게 알리지 않습니다 (그냥 값만 기억하는 상자).
  // 그래서 여기서 늘려도 무한 재렌더가 발생하지 않고, 다른 상태(count 등)가
  // 바뀌어서 이 함수가 재실행될 때마다 "덤으로" 값이 하나씩 늘어납니다.
  const renderCount = useRef(0);
  renderCount.current += 1; // 이 줄은 SpaDemoPage 함수가 실행될 때마다(=렌더될 때마다) 실행됨

  // ==========================================================================
  //  섹션 A. "새로고침 없이 화면이 바뀐다" 증명용 카운터
  // --------------------------------------------------------------------------
  //  useState(0) 은 "count 라는 상태를 만들고 초기값은 0" 이라는 뜻입니다.
  //  반환값은 [현재값, 값을바꾸는함수] 두 개짜리 배열이고, 그걸 구조분해로
  //  count / setCount 두 변수에 나눠 받습니다.
  //  중요: 이 count는 "전역변수"가 아닙니다. React가 "이 SpaDemoPage 컴포넌트
  //  인스턴스"에 묶어서 따로 기억해주는 값입니다. 이 페이지를 두 탭에서 열면
  //  각 탭의 count는 완전히 독립적입니다.
  // ==========================================================================
  const [count, setCount] = useState(0);

  function handleIncrement() {
    // setCount를 부르면 일어나는 일:
    //  1) React가 count의 새 값을 저장한다
    //  2) React가 "SpaDemoPage 함수를 처음부터 다시 실행"한다 (=리렌더)
    //  3) 그 결과로 나온 새 JSX로 화면의 필요한 부분만 갱신한다
    // 이 과정에서 브라우저 주소창의 새로고침(F5)은 전혀 일어나지 않습니다.
    // 그래서 renderCount(위 useRef)가 이 클릭 한 번에 1씩 늘어나는 걸 볼 수 있습니다.
    setCount(count + 1);
  }

  // ==========================================================================
  //  섹션 B. 서버와 실제로 데이터를 주고받기 (JSX + fetch + async/await)
  // ==========================================================================
  const [notes, setNotes] = useState<Note[]>([]); // <Note[]> 가 제네릭 — "이 상태는 Note 배열"이라고 못박음
  const [text, setText] = useState('');           // 입력창에 입력 중인 글자
  const [loading, setLoading] = useState(false);  // "불러오는 중..." 표시용
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);   // 아래에서 실시간으로 찍는 "동작 로그"

  // 동작 로그를 화면에 쌓는 헬퍼. 시각까지 찍어서 "몇 초 뒤에 응답이 왔는지" 체감되게.
  function pushLog(msg: string) {
    const t = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLog((prev) => [...prev, `[${t}] ${msg}`]); // 배열은 직접 수정하지 않고 "새 배열"을 만들어 교체
  }

  // --------------------------------------------------------------------------
  //  목록을 서버에서 가져오는 함수. async 함수라서 내부에서 await 를 쓸 수 있음.
  //  이 함수 자체도 호출하면 Promise를 반환합니다 (async 함수는 항상 그렇습니다).
  // --------------------------------------------------------------------------
  async function loadNotes() {
    setLoading(true);
    setError(null);
    pushLog('1) GET /api/learn/notes 요청 시작');
    try {
      // fetch()는 "네트워크 요청을 보내라"는 뜻이고, 즉시 Promise를 반환합니다.
      // await 는 "이 Promise가 끝날 때까지 이 함수(loadNotes) 실행을 잠깐 멈춰라"
      // 라는 뜻입니다. 중요한 건 "이 함수만" 멈추는 거지, 브라우저 전체나 다른
      // 이벤트 처리(예: 다른 버튼 클릭)가 멈추는 게 아니라는 점입니다 —
      // 그래서 "논블로킹(non-blocking)"이라고 부릅니다.
      const res = await fetch('/api/learn/notes');
      pushLog('2) 서버 응답 도착 (아직 JSON 파싱 전)');

      // res.json() 도 Promise 입니다 (응답 본문을 다 읽어 JS 객체로 바꾸는 데
      // 시간이 걸리기 때문). 그래서 여기도 await.
      const data: Note[] = await res.json();
      pushLog(`3) JSON 파싱 완료 — ${data.length}개 받음`);

      setNotes(data); // 상태 변경 → SpaDemoPage 재렌더 → 화면의 목록이 갱신됨
      pushLog('4) setNotes 호출 → 화면 다시 그려짐(리렌더)');
    } catch (e) {
      setError('목록을 불러오지 못했습니다.');
      pushLog('! 에러 발생: ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------------------------------
  //  useEffect(fn, [])  —  의존성 배열이 빈 배열([]) 이면 "화면에 처음 뜰 때 딱
  //  한 번만" 실행됩니다. Spring의 @PostConstruct(초기화)와 비슷한 위치입니다.
  //  여기서는 페이지가 열리자마자 서버에서 메모 목록을 한 번 가져옵니다.
  // --------------------------------------------------------------------------
  useEffect(() => {
    loadNotes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------------------------------------------------------------------
  //  "메모 추가" 버튼 핸들러.
  //
  //  ★ 여기서 일부러 <form onSubmit=...> 를 쓰지 않고 <button onClick=...> 을
  //  씁니다. JSP/서블릿에서 흔히 하던 방식은:
  //
  //    <form method="post" action="/save">
  //      <input name="text" />
  //      <button type="submit">저장</button>
  //    </form>
  //
  //  이렇게 하면 버튼을 누르는 순간 브라우저가 "완전히 새로운 페이지 요청"을
  //  서버에 보내고, 응답으로 받은 HTML 전체로 화면을 통째로 교체합니다(=새로고침).
  //
  //  SPA(React) 방식은 페이지를 통째로 다시 받지 않습니다. 버튼 클릭이라는
  //  "이벤트"에 연결된 JS 함수(아래 handleAdd)가 실행되고, 그 함수 안에서
  //  fetch()로 필요한 데이터만 서버에 보낸 뒤, 응답으로 받은 JSON만 갖고
  //  React가 화면의 "목록 부분만" 다시 그립니다. 주소창도 그대로고, 페이지
  //  깜빡임도 없습니다. 이게 이 페이지 전체에서 가장 핵심적으로 보여주고 싶은 부분입니다.
  // --------------------------------------------------------------------------
  async function handleAdd() {
    const value = text.trim();
    if (!value) return;

    pushLog(`1) POST /api/learn/notes 요청 시작 (text="${value}")`);
    try {
      const res = await fetch('/api/learn/notes', {
        method: 'POST',
        // 서버에 "이 본문은 JSON이다"라고 알려주는 헤더. 없으면 서버가 body를
        // 문자열로만 보고 req.json()에서 파싱을 잘못할 수 있습니다.
        headers: { 'Content-Type': 'application/json' },
        // JS 객체를 JSON 문자열로 바꿔서 보냅니다 (서버의 req.json()이 이걸 다시 객체로 바꿈).
        body: JSON.stringify({ text: value }),
      });
      pushLog('2) 서버 응답 도착');

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const created: Note = await res.json();
      pushLog(`3) 저장 완료 (id=${created.id})`);

      setText('');              // 입력창 비우기
      await loadNotes();        // 4) 서버 목록을 다시 불러와 화면에 반영 (재조회)
    } catch (e) {
      setError('저장에 실패했습니다.');
      pushLog('! 에러 발생: ' + String(e));
    }
  }

  async function handleDelete(id: number) {
    pushLog(`1) DELETE /api/learn/notes?id=${id} 요청 시작`);
    await fetch(`/api/learn/notes?id=${id}`, { method: 'DELETE' });
    pushLog('2) 삭제 완료 → 목록 다시 불러오기');
    await loadNotes();
  }

  // ==========================================================================
  //  아래부터는 JSX 입니다. return 뒤에 오는 이 태그처럼 생긴 것은 진짜 HTML이
  //  아니라, 빌드 시점에 React.createElement(...) 함수 호출들로 변환되는
  //  문법입니다. 즉 "화면에 뭐가 있어야 하는지"를 표현하는 JS 표현식일 뿐이고,
  //  실제 브라우저 DOM 조작은 React가 대신 해줍니다.
  //
  //  { count } 처럼 중괄호 안에 변수/식을 쓰면 그 값이 그 자리에 그대로
  //  텍스트로 들어갑니다. { count % 2 === 0 ? '짝수' : '홀수' } 처럼 식도 가능합니다.
  // ==========================================================================
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'sans-serif', color: '#0f172a' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>SPA / JSX / fetch 학습 페이지</h1>
      <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.6 }}>
        이 페이지는 실제 서비스 화면이 아니라, 문법을 눈으로 확인하기 위한 실습용 페이지입니다.
        (API: <code>app/api/learn/notes/route.ts</code> · 화면: <code>app/learn/spa-demo/page.tsx</code>)
      </p>

      {/* ===================== 섹션 A ===================== */}
      <section style={box}>
        <h2 style={h2}>A. 새로고침 없이 화면이 바뀐다 (SPA)</h2>
        <p style={p}>
          아래 버튼을 눌러보세요. 주소창의 새로고침 아이콘이 도는지 확인해보세요 — 돌지 않습니다.
          그런데도 숫자는 바뀝니다. 그 이유는 <b>setCount가 호출될 때마다 이 페이지를 그리는
          SpaDemoPage 함수가 처음부터 다시 &quot;실행&quot;</b>되기 때문입니다. 그 증거로, 아래
          &quot;이 함수가 실행된 횟수&quot;도 클릭할 때마다 같이 늘어납니다.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={handleIncrement} style={btn}>클릭 {count}</button>
          <span style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 700 }}>
            이 컴포넌트 함수가 지금까지 실행된 횟수: <b>{renderCount.current}</b>
          </span>
        </div>
      </section>

      {/* ===================== 섹션 B ===================== */}
      <section style={box}>
        <h2 style={h2}>B. 서버로 데이터 보내고 받기 (fetch, form 아님)</h2>
        <p style={p}>
          아래 입력창 + 버튼은 &lt;form&gt; 태그가 아닙니다. 버튼 클릭 → JS 함수(handleAdd)
          실행 → fetch로 서버에 JSON 전송 → 응답 JSON을 받아 목록 갱신, 순서로 동작합니다.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            // Enter 키로도 추가되게 (실전 UX에서도 자주 쓰는 패턴)
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="메모를 입력하세요"
            style={input}
          />
          <button onClick={handleAdd} style={btn}>추가</button>
        </div>

        {loading && <div style={{ fontSize: 13, color: '#94a3b8' }}>불러오는 중…</div>}
        {error && <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {notes.map((n) => (
            <li key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
              <span>{n.text}</span>
              <button onClick={() => handleDelete(n.id)} style={{ ...btn, background: '#fee2e2', color: '#dc2626', padding: '4px 10px', fontSize: 12 }}>삭제</button>
            </li>
          ))}
          {notes.length === 0 && !loading && <li style={{ color: '#94a3b8', fontSize: 13 }}>아직 메모가 없습니다.</li>}
        </ul>
      </section>

      {/* ===================== 섹션 C ===================== */}
      <section style={box}>
        <h2 style={h2}>C. async/await/Promise 동작 순서 (실시간 로그)</h2>
        <p style={p}>
          위 버튼들을 누르면 아래에 로그가 쌓입니다. &quot;요청 시작&quot;과 &quot;응답 도착&quot; 사이에
          시간차가 있는 걸 볼 수 있는데, 그 사이(await로 기다리는 동안)에도 섹션 A의
          카운터 버튼은 눌러도 즉시 반응합니다 — 브라우저가 멈추지 않는다는 뜻입니다.
        </p>
        <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 10, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
          {log.length ? log.join('\n') : '아직 로그가 없습니다. 위에서 버튼을 눌러보세요.'}
        </pre>
      </section>
    </div>
  );
}

const box: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, marginTop: 18 };
const h2: React.CSSProperties = { fontSize: 15.5, fontWeight: 800, marginBottom: 8 };
const p: React.CSSProperties = { fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 12 };
const btn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, padding: '10px 16px', borderRadius: 10, cursor: 'pointer' };
const input: React.CSSProperties = { flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 14 };
