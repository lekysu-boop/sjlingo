# LEARN.md — 기존 개발자를 위한 Node.js / Next.js 입문 가이드

> 대상 독자: **Classic ASP · Spring · Java · PL/SQL · Oracle/MSSQL 경험이 있고,
> Node.js / Next.js / 모던 JavaScript 는 처음인 분.**
> 이 문서는 "이미 아는 개념에 빗대어" 새 스택을 이해시키는 것이 목표입니다.

---

## 0. 큰 그림 — 이 프로젝트는 어떤 구조인가?

```
[브라우저 화면]        [Next.js 서버]              [Supabase = PostgreSQL]
 React 컴포넌트   →   app/api/*/route.ts    →      테이블(profiles, keywords…)
 (JSP/화면단)         (Controller + Service)        (Oracle/MSSQL 자리)
        ↑  fetch(JSON)          ↑  service_role 키로 접속
```

익숙한 3계층(화면 → 서버로직 → DB)과 **똑같습니다.** 이름만 다릅니다.

| 익숙한 것 | 이 프로젝트 | 비고 |
|---|---|---|
| JSP / Thymeleaf | React 컴포넌트 (`.tsx`) | 화면 |
| Spring `@RestController` | `app/api/.../route.ts` | HTTP 요청 처리 |
| Spring `@Service` | `hooks/*`, `lib/*` | 재사용 로직 |
| JDBC / MyBatis | `@supabase/supabase-js` | DB 접근 |
| Oracle / MSSQL | Supabase(PostgreSQL) | DB 서버(관리형) |
| WAS(Tomcat) 설치·운영 | Vercel (자동) | 서버 운영 대행 |
| web.xml / application.yml | `.env.local` + 파일 위치 규칙 | 설정 |

---

## 1. Node.js 와 npm — "JVM 과 Maven" 이라고 생각하세요

- **Node.js** = 브라우저 밖에서 JavaScript 를 실행하는 런타임. **JVM** 에 해당.
- **npm** = 라이브러리(패키지) 관리 도구. **Maven / Gradle** 에 해당.
  - `package.json` = `pom.xml`. 의존성 목록과 실행 스크립트가 들어 있습니다.
  - `npm install` = `mvn install`. 의존성을 내려받아 `node_modules/` 폴더에 넣습니다.
    (`node_modules` 는 `.m2` 저장소처럼 용량이 크고, 깃허브에 올리지 않습니다.)
  - `npm run dev` = 개발 서버 실행 (로컬에서 코드를 바로 확인).
  - `npm run build` = 배포용 빌드 (`mvn package` 에 해당).

---

## 2. 모던 JavaScript 문법 — 딱 이것만 알면 코드가 읽힙니다

### 2-1. `const` / `let` (변수 선언)
```js
const a = 10;   // 재할당 불가 (Java 의 final)
let  b = 20;    // 재할당 가능
// var 는 옛날 문법이라 이 프로젝트에서 안 씁니다.
```

### 2-2. 화살표 함수 `=>` — Java 의 람다와 같습니다
```js
// 아래 두 개는 완전히 같은 함수입니다.
function add(a, b) { return a + b; }      // 전통 방식
const add = (a, b) => { return a + b; };  // 화살표 방식
const add = (a, b) => a + b;              // 본문이 한 줄이면 {}, return 생략 가능

// Java 로 치면:   (a, b) -> a + b
```
`list.map((u) => u.name)` 은 Java 의 `list.stream().map(u -> u.getName())` 과 같습니다.
자주 보는 배열 메서드:
- `.map(fn)` : 각 원소를 변환한 **새 배열** (stream().map)
- `.filter(fn)` : 조건에 맞는 것만 (stream().filter)
- `.find(fn)` : 조건에 맞는 첫 원소 (stream().findFirst)
- `.some(fn)` : 하나라도 만족하면 true (stream().anyMatch)

### 2-3. `async` / `await` — 비동기, 하지만 동기처럼 읽힙니다
DB·네트워크처럼 결과가 늦게 오는 작업에 붙입니다.
```js
async function loadUsers() {
  const users = await listUsers(); // 결과가 올 때까지 "기다림"
  console.log(users);              // 그 다음에 실행됨
}
```
`await` = "이 작업이 끝날 때까지 기다렸다가 결과를 꺼내라". Java 의 `Future.get()` 과
비슷하지만 스레드를 막지 않고 문법이 훨씬 간결합니다. `await` 를 쓰려면 그 함수가
`async` 여야 합니다.

### 2-4. 구조 분해 (destructuring) — 객체/배열에서 값 꺼내기
```js
const { data, error } = await db.from('profiles').select('*');
// 위 한 줄 = const result = ...; const data = result.data; const error = result.error;

const [value, setValue] = useState(0);
// 배열의 0번째를 value, 1번째를 setValue 로 한 번에 받음
```

### 2-5. 기타 관용구
```js
const name = body.name || '손님';   // body.name 이 비었으면 '손님' (Java 삼항연산자)
const x = obj?.field;               // obj 가 null 이면 에러 없이 undefined (?. = null 안전 접근)
const y = a ?? b;                   // a 가 null/undefined 면 b (널 병합)
`안녕 ${name}님`;                    // 템플릿 문자열 = "안녕 " + name + "님"
```

---

## 3. TypeScript — "타입 있는 JavaScript"

Java 처럼 타입을 붙여 컴파일 시점에 실수를 잡습니다. 실행 시엔 사라집니다.
```ts
interface Profile { id: string; name: string; email?: string; } // email? = 있어도/없어도 됨
function greet(p: Profile): string { return `안녕 ${p.name}`; }
```
- `interface` = DTO/VO 의 필드 선언과 비슷 (구조를 설명).
- `string | null` = "문자열 또는 null" (유니온 타입).
- 파일 확장자: 화면(JSX 포함)은 `.tsx`, 순수 로직은 `.ts`.

---

## 4. React — "화면을 상태(state)의 함수로 그린다"

Classic ASP/JSP 는 "요청이 오면 HTML 을 문자열로 만들어 보냄"이었죠.
React 는 다릅니다: **데이터(state)가 바뀌면 화면이 자동으로 다시 그려집니다.**

```tsx
function Counter() {
  const [n, setN] = useState(0);          // 상태 변수 n, 바꾸는 함수 setN
  return <button onClick={() => setN(n + 1)}>클릭 {n}</button>;
  // setN 을 부르면 React 가 이 함수를 다시 실행해 화면을 갱신함
}
```
- **컴포넌트** = 화면 조각을 그리는 함수. 이름은 대문자로 시작.
- **JSX** = 함수 안에 HTML 처럼 쓰는 문법. `className` 이 HTML 의 `class` 입니다.
- **훅(Hook)** = `use...` 로 시작하는 함수. 상태·생명주기를 컴포넌트에 붙임.
  - `useState` : 화면에 반영되는 변수
  - `useEffect(fn, [])` : 처음 뜰 때 1번 실행 (초기 데이터 로딩 등)
  - 커스텀 훅(`useUser` 등) = Service 처럼 로직을 모아 재사용

---

## 5. Next.js — "파일 위치가 곧 URL"

Spring 은 `@RequestMapping("/users")` 로 URL 을 정했지만, Next.js(App Router)는
**폴더/파일 이름이 곧 주소**입니다.

| 파일 | URL | 역할 |
|---|---|---|
| `app/page.tsx` | `/` | 화면 (로그인) |
| `app/home/page.tsx` | `/home` | 화면 (홈) |
| `app/api/users/route.ts` | `/api/users` | REST API |
| `app/api/keywords/[id]/route.ts` | `/api/keywords/123` | `[id]` = 경로 변수 |

- `page.tsx` = 사람이 보는 화면.
- `route.ts` = 데이터를 주고받는 API. 이 파일 안에 `GET`, `POST`, `PATCH`,
  `DELETE` 라는 이름의 함수를 export 하면 각 HTTP 메서드 핸들러가 됩니다.
- 서버 컴포넌트 vs 클라이언트 컴포넌트: 파일 맨 위에 `'use client'` 가 있으면
  브라우저에서 실행(상태·클릭 필요할 때), 없으면 서버에서 실행이 기본입니다.

---

## 6. 이 프로젝트를 읽는 추천 순서

1. `lib/types.ts` — 데이터 모양(테이블 DTO)부터 파악. **여기부터 보세요.**
2. `supabase/schema.sql` — 실제 DB 테이블. Oracle DDL 처럼 읽힙니다.
3. `app/api/users/route.ts` — **가장 주석이 자세한 API.** 여기서 패턴을 익히세요.
4. `lib/supabase/admin.ts` — DB 접속(=JDBC Connection).
5. `lib/api.ts` — 화면이 서버 API 를 부르는 함수 모음(클라이언트 측).
6. `hooks/useUser.ts` — Service 역할의 커스텀 훅(주석 자세함).
7. `app/page.tsx` → `app/home/page.tsx` — 화면이 위 조각들을 어떻게 쓰는지.

나머지 API(`keywords`, `exams`, `progress`, `gamify`)는 3번과 **똑같은 패턴**의
반복입니다. 하나를 이해하면 전부 읽힙니다.

---

## 7. 자주 나오는 용어집

| 용어 | 한 줄 설명 (익숙한 것에 비유) |
|---|---|
| 런타임(runtime) | 코드를 실행하는 환경. Node = 서버용 JS 실행기 (JVM) |
| 패키지(package) | 라이브러리 (jar) |
| 번들(bundle) | 여러 JS 파일을 배포용으로 합친 결과물 (war 비슷) |
| 엔드포인트(endpoint) | 하나의 API 주소 (`/api/users`) |
| 페이로드(payload) | 요청/응답 본문 데이터 (@RequestBody) |
| 훅(hook) | React 에서 상태·기능을 붙이는 `use...` 함수 |
| 상태(state) | 화면에 반영되는 변수. 바뀌면 화면 재렌더 |
| props | 부모 컴포넌트가 자식에게 넘기는 값 (메서드 파라미터) |
| 렌더(render) | 컴포넌트 함수를 실행해 화면을 그리는 것 |
| RLS | Row Level Security. 행 단위 접근 제어(뷰+권한과 비슷) |
| 환경변수 | 접속키 등 코드 밖 설정값 (System.getenv) |
| SSR / CSR | 서버에서 그림 / 브라우저에서 그림 |

---

## 8. 인증(로그인)은 지금 어떻게 되어 있고, 어떻게 확장하나?

- **지금**: 이름만 골라 시작(`auth_provider='guest'`). 선택한 사용자 id 를
  브라우저 `localStorage` 에 저장해 자동 로그인. 별도 비밀번호 없음.
- **DB/API 는 이미 이메일 확장 준비 완료**: `profiles` 테이블에 `email`,
  `auth_provider`, `auth_user_id` 컬럼이 있고, `POST /api/users` 에 이메일
  중복 검사 로직이 들어 있습니다.
- **확장 절차**: `supabase/schema.sql` 하단 "옵션 B" 주석 참고. Supabase 대시보드에서
  이메일 로그인을 켜고 RLS 정책만 추가하면, **화면은 그대로 두고** 인증만 강화됩니다.

> 자세한 배포·깃허브 방법은 `DEPLOY.md`, 개발도구·스택·풀스택 로드맵은 `GUIDE.md` 를 보세요.
