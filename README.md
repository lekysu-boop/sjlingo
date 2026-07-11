# 암기 마스터 — Next.js + Supabase + Vercel

초개인화 암기코드 / 기출문제 반복 학습 플랫폼의 **실서비스용 구현 스캐폴드**입니다.
디자인 프로토타입(`한국사 암기마스터 v3.dc.html`)의 기능을 그대로 옮기되, 데이터를 브라우저 localStorage가 아니라 **Supabase(PostgreSQL)** 에 저장하고 **REST API**로 주고받도록 구조화했습니다.

> ### 📚 처음 오셨나요? (Node.js/Next.js 가 처음인 기존 개발자용)
> Classic ASP · Spring · Java · PL/SQL · Oracle/MSSQL 경험이 있고 이 스택이 처음이라면,
> 아래 문서를 순서대로 보세요.
> - **[`GETTING_STARTED.md`](./GETTING_STARTED.md)** — VS Code만 깔린 상태에서 실행~배포까지 처음부터 (여기부터!)
> - **[`WORKFLOW.md`](./WORKFLOW.md)** — claude.ai↔GitHub↔VS Code 관계 (코드 동기화가 헷갈리면 필독)
> - **[`LEARN.md`](./LEARN.md)** — 모던 JS 문법·React·Next 개념을 익숙한 것에 빗대어 설명 + 용어집
> - **[`PROJECT_STUDY_GUIDE.md`](./PROJECT_STUDY_GUIDE.md)** — 실제 프로그램 흐름을 따라가는 5일 실습·디버깅 가이드
> - **[`DATABASE.md`](./DATABASE.md)** — DB 관리 툴·DDL/DML·백업 (Oracle/MSSQL 경험자용)
> - **[`GUIDE.md`](./GUIDE.md)** — 개발 도구(VS Code/IntelliJ) 추천, 이 스택의 시장 위상,
>   남의 JS 관리법, 풀스택 학습 로드맵
> - **[`DEPLOY.md`](./DEPLOY.md)** — GitHub·Vercel·Supabase 배포(가입~도메인 연결)와 CI/CD
>
> 소스 파일에는 초보자용 상세 주석이 있습니다 —
> 특히 `app/api/users/route.ts`, `hooks/useUser.ts`, `lib/supabase/admin.ts` 부터 보세요.

---

## 1. 기술 스택 결정 (왜 이렇게?)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | **Next.js 14 (App Router)** | 화면(React)과 서버 API를 한 프로젝트에서 구현 |
| 서버 API | **Next.js Route Handlers (Node.js 런타임)** | **PHP/Laravel 불필요.** 전부 TypeScript로 구현 가능 |
| DB | **PostgreSQL (Supabase 관리형)** | Supabase에 기본 내장. 별도 DB 설치 불필요 |
| 배포 | **Vercel** | Next.js 네이티브 배포. Git push → 자동 배포 |
| 데이터 교환 | **REST (JSON)** | `/api/*` 엔드포인트로 CRUD |

> **PHP는 쓰지 않습니다.** Next.js Route Handler가 서버사이드(Node)에서 실행되므로 서버 로직·DB 접근·구글시트 가져오기까지 전부 Node.js로 처리합니다.

---

## 2. 폴더 구조

```
nextjs/
├─ app/
│  ├─ api/                     # 서버사이드 REST API (Node 런타임)
│  │  ├─ users/route.ts        # GET 목록 / POST 생성
│  │  ├─ subjects/route.ts     # GET / POST
│  │  ├─ keywords/route.ts     # GET / POST(단건·대량, 중복스킵)
│  │  ├─ keywords/[id]/route.ts# PATCH / DELETE
│  │  ├─ exams/route.ts
│  │  ├─ exams/[id]/route.ts
│  │  ├─ progress/[userId]/route.ts  # 진도·월간·응원 집계
│  │  ├─ cheers/route.ts       # POST 응원
│  │  ├─ gamify/[userId]/route.ts    # GET 게이미피케이션 상태
│  │  ├─ gamify/reward/route.ts      # POST 학습 보상(XP·하트·스트릭)
│  │  ├─ gamify/league/route.ts      # GET 주간 리그 순위
│  │  └─ import/sheet/route.ts # 구글시트 CSV 서버사이드 파싱
│  ├─ (ui)/                    # 화면 (프로토타입 → 페이지로 이관)
│  │  ├─ page.tsx              # / 로그인·사용자 선택
│  │  ├─ home/page.tsx         # /home 과목 선택 + 두 학습 프로그램
│  │  ├─ stats/page.tsx        # /stats 통계·월간 차트·응원
│  │  ├─ study/keyword/page.tsx# /study/keyword 키워드 인출(게임모드·세션·게이미피케이션)
│  │  ├─ study/exam/page.tsx   # /study/exam 기출 풀이(세션·게이미피케이션)
│  │  ├─ league/page.tsx       # /league 주간 XP 리더보드
│  │  └─ data/page.tsx         # /data 데이터 관리(시트·기본데이터·CRUD)
│  └─ layout.tsx               # SessionProvider 포함
├─ components/
│  └─ Gamify.tsx               # 콘페티·XP플로터·HUD(스트릭/XP링/하트)·콤보 배지
├─ lib/
│  ├─ types.ts                 # 공용 타입
│  ├─ dedupe.ts                # 암기코드/기출 중복 판정 로직
│  ├─ api.ts                   # 프론트 fetch 래퍼
│  └─ supabase/
│     ├─ client.ts             # 브라우저용
│     ├─ server.ts             # 서버컴포넌트/라우트용
│     └─ admin.ts              # service-role (서버 전용)
├─ hooks/                      # useUser, useSubjects, useKeywords, useExams, useProgress, useSession, useGamification
├─ supabase/schema.sql         # DB 스키마 + RLS
├─ .env.example
├─ package.json
└─ next.config.mjs
```

---

## 3. 5분 셋업

```bash
# 1) 의존성 설치
cd nextjs && npm install

# 2) Supabase 프로젝트 생성 → SQL Editor에 supabase/schema.sql 붙여넣고 실행

# 3) 환경변수: .env.example 복사 후 값 채우기
cp .env.example .env.local

# 4) 로컬 실행
npm run dev            # http://localhost:3000

# 5) 배포: GitHub에 push 후 Vercel에서 import, 환경변수 4개 입력 → Deploy
```

자세한 배포 단계는 `DEPLOY.md` 참고.

---

## 4. 인증 방식 (현재: 가벼운 모드)

프로토타입과 동일하게 **이름만 골라 시작**하는 방식입니다.
- 사용자는 `profiles` 테이블의 행이고, 선택한 사용자 id를 브라우저에 기억해 자동 로그인.
- 모든 DB 접근은 **서버 API 라우트**를 통해서만 일어나고, 라우트에서 `owner_id`로 소유권을 강제합니다.
- 브라우저에는 `service_role` 키가 절대 노출되지 않습니다(서버 전용).

> ### 이메일 로그인은 왜 있고, 지금 뭘 해야 하나?
> **목적**: 현재 로그인은 "이름을 목록에서 고르는" 방식이라 비밀번호가 없습니다
> (아무나 남의 이름을 누를 수 있음). 가족·학원처럼 서로 믿는 소수라면 이대로 충분합니다.
> 나중에 **불특정 다수에게 실제 서비스로 공개**할 때, 각자 비밀번호로 계정을 보호하고
> 어느 기기에서든 로그인하게 하려면 이메일 로그인이 필요합니다.
>
> **지금 할 일**: 없습니다. 화면(이름 선택)은 그대로 두고, 나중을 위해 서버·DB만
> 미리 준비해 뒀습니다 — `profiles.email`/`password_hash` 컬럼, `POST /api/auth/signup`
> (bcrypt 해싱), `POST /api/auth/login` (bcrypt 대조). 이메일 가입 폼을 화면에 붙이고
> 싶어질 때 이 API 를 호출하면 됩니다. `lib/auth.ts` 에 검증 규칙이 있습니다.

> 나중에 이메일/소셜 로그인이 필요하면 **Supabase Auth**로 승격할 수 있도록 스키마에 RLS 정책을 미리 넣어 두었습니다 (`schema.sql` 하단 주석 참고).

---

## 5. 게이미피케이션 (듀오링고식 재미 요소)

학습 세션(`/study/keyword`, `/study/exam`)에 다음 장치가 서버 상태와 연동되어 작동합니다.

| 요소 | 동작 | 저장 위치 |
|---|---|---|
| 🔥 스트릭 | 매일 첫 세션 완료 시 +1, 하루 건너뛰면 리셋 | `gamify_state.streak` |
| 🎯 일일 XP 링 | 정답마다 XP가 차오름, 자정에 리셋 | `today_xp` / `daily_goal` |
| 💥 콤보 | 연속 정답 3회↑ 보너스 XP(+5) | `lib/gamify.xpFor()` |
| 🎊 정답 연출 | 콘페티 + `+N XP` 플로터 + 마스코트 환호 | `components/Gamify.tsx` |
| ❤️ 하트(생명) | 오답 시 감소, 30분당 1개 자동 회복 | `hearts` / `hearts_updated` |
| 🎁 세션 완료 | 스트릭 +1, 코인 +20, 자축 애니메이션 | `gamify/reward` |
| 🏆 주간 리그 | 이번 주 XP 순위, 상위 3명 승급 | `league_scores` |

동작 흐름:
```
정답/오답 → useGamification.onCorrect(combo)/onWrong()
         → POST /api/gamify/reward  (XP·하트·리그 점수 계산)
         → 반환된 fx 신호로 콘페티·플로터·하트깨짐 애니메이션 트리거
세션 끝   → completeSession() → 스트릭 갱신
```

순수 계산(스트릭 판정·하트 회복·주 계산)은 `lib/gamify.ts`에 부작용 없이 분리되어 있어 테스트가 쉽습니다.

---

## 6. 학습 로드맵 (이 프로젝트로 Node/Next 익히기)

기존 개발자(Spring·Java·PL/SQL) 기준 추천 학습 순서입니다.

1. **[`LEARN.md`](./LEARN.md) 통독** — 모던 JS 문법(`=>`, `async/await`, 구조 분해),
   React 훅, Next.js "파일=URL" 개념을 익숙한 개념에 빗대어 설명. 용어집 포함.
2. **[`PROJECT_STUDY_GUIDE.md`](./PROJECT_STUDY_GUIDE.md) 실습** — 키워드·기출·데이터 관리의
   화면 → API → DB 흐름을 하루씩 직접 추적하고 테스트·디버깅합니다.
3. **데이터 모양 파악** — `lib/types.ts` → `supabase/schema.sql` (Oracle DDL 처럼 읽힘).
4. **API 한 개를 깊게** — `app/api/users/route.ts` (가장 주석이 상세). GET/POST 패턴을
   여기서 익히면 `keywords`·`exams`·`gamify` 는 같은 패턴의 반복이라 술술 읽힙니다.
5. **DB 접속 계층** — `lib/supabase/admin.ts` (JDBC Connection 자리, 보안 주의점).
6. **화면 로직(Service)** — `hooks/useUser.ts` (커스텀 훅 = Service 비유, 주석 상세).
7. **화면(View)** — `app/page.tsx`(로그인) → `app/home/page.tsx`(홈)에서 위 조각들이
   어떻게 조립되는지 확인.
8. **배포** — [`DEPLOY.md`](./DEPLOY.md) 를 따라 GitHub → Vercel → Supabase 연결.

### 아키텍처 대응표 (익숙한 것 → 이 프로젝트)

| 익숙한 개념 | 이 프로젝트 |
|---|---|
| JSP / 화면단 | React 컴포넌트 (`app/**/page.tsx`) |
| `@RestController` | `app/api/**/route.ts` |
| `@Service` | `hooks/*`, `lib/*` |
| JDBC / MyBatis | `@supabase/supabase-js` (`lib/supabase/*`) |
| Oracle / MSSQL | Supabase(PostgreSQL) — `supabase/schema.sql` |
| Maven `pom.xml` | `package.json` |
| WAS(Tomcat) 운영 | Vercel (자동 배포) |
| `application.yml` | `.env.local` + 파일 위치 규칙 |

### 인증 확장 요약
현재는 이름 기반(`auth_provider='guest'`)이지만, `profiles` 테이블에 `email` /
`auth_provider` / `auth_user_id` 컬럼과 이메일 중복 검사 로직이 이미 있어 **UI 변경 없이**
이메일 인증으로 확장할 수 있습니다. 자세한 절차는 `schema.sql` 하단 "옵션 B" 주석 참고.
