# GUIDE.md — 개발 도구·스택·협업·풀스택 로드맵

> 기존 개발자(Spring·Java·PL/SQL)가 Node/Next 로 넘어올 때 자주 하는 질문에 답하는 문서입니다.
> 문법·아키텍처는 [`LEARN.md`](./LEARN.md), 배포는 [`DEPLOY.md`](./DEPLOY.md) 를 참고하세요.

---

## 1. 어떤 개발 도구(IDE)를 쓸까?

**결론: 로컬 노트북 + VS Code 를 메인으로. Codespace(원격)는 느리면 학습에 방해됩니다.**

| 도구 | 추천도 | 설명 |
|---|---|---|
| **VS Code** (무료) | ★ 학습 1순위 | Node/Next 생태계의 사실상 표준. 튜토리얼·확장·에러 검색이 전부 이 기준 |
| **IntelliJ / WebStorm** (AI 라이선스 보유) | ★ 실무 병행 | Java 에서 쓰던 단축키·리팩토링·디버거 그대로. Node/TS 완전 지원 |
| 아이패드 + Codespace | △ 보조용 | 이동 중 가벼운 수정·확인만. 본 개발은 로컬 |

- **추천 흐름**: VS Code 로 개념·튜토리얼을 익히고, 손에 익으면 IntelliJ 로 옮겨도 좋습니다.
  당신은 이미 IntelliJ 가 익숙하니 **두 개를 병행**하는 게 가장 빠릅니다.
- **맥북 vs 윈도우**: 둘 다 문제없습니다. 맥이 배포 환경(리눅스)과 더 유사해 마찰이 적지만,
  윈도우도 충분합니다. (윈도우라면 WSL2 를 켜두면 터미널 경험이 더 매끄럽습니다.)

### VS Code 필수 확장
- **ESLint** — 문법·품질 실시간 검사 (Checkstyle/SonarLint 역할)
- **Prettier** — 저장 시 자동 정렬 (코드 스타일 통일)
- **Tailwind CSS IntelliSense** — CSS 클래스 자동완성
- **GitLens** — Git 이력·blame 확인
- **ES7+ React snippets** — React 코드 스니펫

> 설정 파일(`.eslintrc.json`, `.prettierrc.json`, `.editorconfig`)이 저장소에 있어,
> VS Code·IntelliJ 어느 쪽을 쓰든 **같은 코드 스타일**이 자동 적용됩니다.

---

## 2. 이 스택은 요즘 일반적인가? (배워두면 재활용되나?)

**네. 현재 웹 개발의 주류 조합이라 투자 가치가 높습니다.**

| 기술 | 시장 위상 (익숙한 것에 비유) |
|---|---|
| **React** | 프론트엔드 점유율 1위. 한 번 배우면 대부분 웹 프론트에 통용 |
| **Next.js** | React 기반 풀스택 프레임워크 표준 (Java 웹의 Spring 같은 위치) |
| **TypeScript** | 실무 기본값. 정적 타입이라 Java 개발자에게 오히려 편함 |
| **PostgreSQL/Supabase** | 스타트업·중소 서비스 표준 DB |

즉 **TypeScript + React + Next.js + PostgreSQL** 은 이직·사이드 프로젝트에 그대로
재활용됩니다. 여기서 익힌 개념(컴포넌트·훅·API 라우트·ORM 쿼리)은 다른 React 계열
프레임워크(Remix, Vite+React 등)로도 대부분 이전됩니다.

---

## 3. 남이 짠 JavaScript 를 효율적으로 관리하는 법

동적 타입 언어라 "런타임에 터지는" 코드가 많습니다. 아래 장치로 **컴파일 시점에**
문제를 잡는 게 핵심입니다.

1. **TypeScript 를 적극 활용** — 함수 인자·반환·객체에 타입을 붙이면, 남의 코드도
   "이 함수가 뭘 받고 뭘 주는지" 타입만 봐도 파악됩니다. `npm run typecheck` 로 전체 검사.
2. **ESLint + Prettier** — 스타일·흔한 실수를 자동 검출·정리. 리뷰에서 "들여쓰기" 같은
   소모적 지적이 사라집니다. `npm run lint`, `npm run format`.
3. **폴더 규칙으로 역할 분리** (이 프로젝트가 그 예시):
   - `app/**/page.tsx` = 화면, `app/api/**/route.ts` = API, `lib/*` = 순수 로직,
     `hooks/*` = 상태 로직, `components/*` = 재사용 UI.
   - "어디에 무엇이 있는지" 규칙이 있으면 남의 코드도 빨리 찾습니다.
4. **작은 함수 + 순수 함수 분리** — 부작용(DB·네트워크) 없는 계산은 `lib/`로 빼서
   테스트·재사용을 쉽게 (예: `lib/gamify.ts`, `lib/dedupe.ts`).
5. **타입 정의를 한곳에** — `lib/types.ts` 처럼 데이터 모양을 모아두면 전체 구조가 한눈에.
6. **읽는 순서를 문서화** — README/LEARN 에 "이 순서로 읽어라"를 적어두면 온보딩이 빨라집니다.
7. **package-lock.json 을 커밋** — 팀원·CI 가 정확히 같은 버전을 설치(`npm ci`)해
   "내 PC 에선 됐는데" 문제를 방지합니다.

---

## 4. 풀스택 개발을 위한 로드맵

Next.js 는 프론트(React)와 백엔드(API 라우트)를 **한 프로젝트에서** 다뤄 풀스택 학습에
이상적입니다. 이미 백엔드(Spring/DB)에 강하니, 아래 순서로 프론트·연결을 보강하세요.

**1단계 — 프론트 기본기**
- HTML/CSS 감 + **React 컴포넌트·상태(useState)·효과(useEffect)**
- 이 프로젝트의 `app/page.tsx` → `home/page.tsx` 를 읽고 수정해 보기

**2단계 — 프론트↔백엔드 연결**
- `fetch` 로 API 호출 (`lib/api.ts`), 로딩/에러 처리
- API 라우트에서 JSON 받기·검증·응답 (`app/api/users/route.ts`)

**3단계 — 데이터베이스**
- 이미 강점. Supabase 쿼리 빌더를 SQL 로 치환해 읽으면 즉시 이해됨
- 인증·RLS(행 보안)로 "본인 데이터만" 접근 (schema.sql 옵션 B)

**4단계 — 운영/배포**
- Git 흐름(branch·PR), CI(GitHub Actions), CD(Vercel 자동 배포) — `DEPLOY.md`
- 환경변수 관리, 로그·모니터링

**5단계 — 심화 (선택)**
- 상태관리(대규모 시 Zustand/React Query), 테스트(Vitest/Playwright),
  서버 컴포넌트·캐싱 전략, 이미지·성능 최적화

> 백엔드가 탄탄하므로 **1~2단계(React + 연결)에 집중**하면 가장 빠르게 풀스택이 됩니다.

---

## 5. 다음에 뭘 해볼까 (이 프로젝트로 실습)
- `app/home/page.tsx` 의 문구·색을 바꿔 저장 → `npm run dev` 로 즉시 확인 (React 감 잡기)
- `app/api/subjects/route.ts` 를 읽고 `users` 라우트와 비교 (같은 패턴 확인)
- 새 API 하나를 흉내 내어 추가 → CI(`npm run lint && npm run typecheck && npm run build`) 통과시키기
- `DEPLOY.md` 대로 GitHub → Vercel 배포까지 한 번 완주 (성취감 + 전체 흐름 체득)
