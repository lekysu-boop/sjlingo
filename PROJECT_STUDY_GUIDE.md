# PROJECT_STUDY_GUIDE.md — 이 프로젝트를 코드로 학습하는 실전 안내서

> 대상: Java/Spring/Oracle 개발 경험은 있지만 TypeScript·React·Next.js가 낯선 개발자  
> 목표: 문법만 읽지 않고, 실제 사용자 행동 하나가 화면 → API → DB로 이어지는 과정을 추적합니다.

---

## 1. 먼저 잡아야 할 전체 구조

이 프로젝트는 익숙한 3계층 구조를 Next.js 파일 규칙으로 배치한 애플리케이션입니다.

```text
브라우저 page.tsx
  └─ hooks/use*.ts              상태와 화면용 Service
       └─ lib/api.ts            REST 호출 모음
            └─ app/api/**/route.ts  Controller + 서버 Service
                 └─ lib/supabase/admin.ts
                      └─ Supabase(PostgreSQL)
```

| Spring/Java에서 익숙한 것 | 이 프로젝트에서 찾을 곳 |
|---|---|
| DTO/VO | `lib/types.ts` |
| Controller | `app/api/**/route.ts` |
| 화면용 Service | `hooks/use*.ts` |
| 공용 Service/Util | `lib/*.ts` |
| Repository/JDBC 접속 | `lib/supabase/*.ts` |
| JSP/Thymeleaf 화면 | `app/**/page.tsx`, `components/*.tsx` |
| DDL | `supabase/schema.sql`, `supabase/migration_*.sql` |

---

## 2. 프로그램별 핵심 흐름

### PROGRAM 1 — 키워드 인출 학습

시작 파일은 `app/study/keyword/page.tsx`입니다.

1. `useSession()`이 현재 사용자/과목 id를 읽습니다.
2. `useKeywords()`가 `/api/keywords`를 통해 카드를 가져옵니다.
3. 사용자가 분류·중요도·게임 모드·개수를 고릅니다.
4. `start()`가 `pickRotating()`으로 최근에 안 본 카드를 우선 선택합니다.
5. 카드 평가 시 `recordKeyword()`가 학습 이력을 저장하고 `srsReview()`가 다음 복습일을 계산합니다.
6. `finishSession()`이 공부시간·정답 수를 `/api/sessions`에 기록하고 XP·코인·퀘스트를 갱신합니다.

관찰 포인트:

- React 상태 머신: `setup → session → done`
- 서버 저장과 로컬 저장의 구분: 진도/통계는 Supabase, SRS·최근 출제 순서는 localStorage
- 순수 함수 분리: `lib/srs.ts`, `lib/rotation.ts`, `lib/gamemode.ts`

### PROGRAM 2 — 기출문제 풀이

시작 파일은 `app/study/exam/page.tsx`입니다.

1. `useExams()`가 현재 과목 문제를 가져옵니다.
2. `wrongExamIds()`로 과거 오답 id를 받아 오답 복습 풀을 만듭니다.
3. `start()`가 문제를 뽑고 `balanceAnswers()`로 정답 위치를 분산합니다.
4. `choose()`가 정오답·콤보·하트·풀이 이력을 한 번에 갱신합니다.
5. `next()` 또는 하트 소진이 `finishSession()`으로 이어집니다.

관찰 포인트:

- 같은 `setup → session → done` 상태 머신을 PROGRAM 1과 어떻게 재사용했는지 비교
- `pick`이 `null`인지로 “아직 답하지 않음/답변 완료” 상태를 표현하는 방법
- DB의 `exam_attempts`가 오답 복습과 통계 양쪽의 원천이 되는 구조

### 데이터 관리 — CRUD와 Google Sheet 가져오기

시작 파일은 `app/data/page.tsx`, 서버는 `app/api/import/sheet/route.ts`입니다.

```text
기본데이터 클릭
  ├─ 한국사 + 키워드: 지정 암기코드 Google Sheet 마스터 탭
  ├─ 한국사 + 기출: 기본적재 / 심화적재 난이도별 Google Sheet
  └─ 그 외: lib/defaultData.ts의 작은 내장 샘플

Google Sheet 공유 URL
  → lib/googleSheet.ts에서 CSV URL 변환/파싱/헤더 탐색
  → route.ts에서 KeywordInput 또는 ExamInput으로 변환
  → lib/dedupe.ts에서 기존/유입 중복 제거
  → Supabase 대량 insert
  → added/skipped/parsed 결과를 화면에 표시
```

한국사 마스터 시트는 `한능검_암기코드_종합_마스터` 탭의 4행을 헤더로 사용합니다.
열 순서가 바뀌어도 `암기코드`, `핵심 개념`, `연상`, `회차`, `중요도` 같은 헤더명으로
찾기 때문에 동작합니다. 시트 탭 id(`gid`)는 `lib/defaultData.ts`의 상수에 고정되어 있습니다.

---

## 3. 추천 학습 순서와 직접 해볼 과제

### 1일차 — 타입과 데이터 모델

읽기: `lib/types.ts` → `supabase/schema.sql`

과제:

1. `Keyword`의 각 필드를 `keywords` 테이블 컬럼과 한 줄씩 대응해 봅니다.
2. `KeywordInput`에 id가 없는 이유를 설명해 봅니다.
3. `importance`가 1~3만 허용되는 위치를 TypeScript, 서버, DB에서 각각 찾습니다.

완료 기준: 화면 입력 객체가 어떤 DB 행이 되는지 말로 설명할 수 있습니다.

### 2일차 — REST 한 바퀴

읽기: `hooks/useKeywords.ts` → `lib/api.ts` → `app/api/keywords/route.ts`

과제:

1. 브라우저 개발자 도구 Network 탭에서 `/api/keywords` 요청을 찾습니다.
2. 서버의 `GET`에서 필터 하나를 읽고 실제 SQL의 `WHERE` 절로 바꿔 적어 봅니다.
3. 중복 키워드를 두 번 등록하고 `added`, `skipped` 값이 어떻게 달라지는지 봅니다.

완료 기준: URL, HTTP 메서드, 요청 JSON, 응답 JSON을 직접 찾을 수 있습니다.

### 3일차 — React 상태 머신

읽기: `app/study/keyword/page.tsx`

과제:

1. `phase`가 바뀌는 모든 줄을 검색합니다.
2. `known` 값이 비동기 상태 갱신 때문에 즉시 변하지 않는 이유와 `finalKnown` 계산을 확인합니다.
3. 카드 수를 3개로 잠시 바꾸고 세션 종료 조건을 디버거로 따라갑니다.

완료 기준: 어떤 상태 변경이 어떤 화면 재렌더를 만드는지 설명할 수 있습니다.

### 4일차 — 순수 함수와 테스트

읽기: `lib/googleSheet.ts`, `lib/dedupe.ts`, `lib/srs.ts`, 각 `__tests__` 파일

과제:

1. `npm run test`를 실행합니다.
2. CSV 헤더 이름을 `핵심개념`에서 `뜻`으로 바꾼 테스트를 추가해 실패를 확인합니다.
3. 필요한 후보 헤더를 코드에 추가한 뒤 테스트를 다시 통과시킵니다.

완료 기준: DB나 브라우저 없이 검증할 로직을 순수 함수로 떼어낼 수 있습니다.

### 5일차 — 운영 데이터와 장애 추적

읽기: `app/data/page.tsx` → `app/api/import/sheet/route.ts` → `lib/googleSheet.ts`

과제:

1. 한국사 과목에서 `한국사 기본데이터`를 누르고 추가/중복/파싱 수를 기록합니다.
2. 한 번 더 눌러 `added=0`, `skipped=674`인지 확인합니다.
3. 비공개 시트 URL이나 잘못된 URL로 오류 메시지를 확인합니다.
4. Supabase Table Editor에서 `importance`가 상=3, 중=2, 하=1로 저장됐는지 확인합니다.

완료 기준: UI 오류를 Network 응답과 서버 처리 단계 중 어디에서 발생했는지 좁힐 수 있습니다.

---

## 4. 주석을 읽고 쓰는 기준

좋은 주석은 코드 번역보다 “왜 이렇게 했는가”를 남깁니다.

- 좋은 예: `known`의 이전 값 때문에 최종 정답 수를 별도로 계산한다.
- 나쁜 예: `setKnown`으로 known을 설정한다.
- 좋은 예: Google 요청을 서버에서 해 CORS와 service_role 노출을 피한다.
- 나쁜 예: `fetch`로 URL을 호출한다.

이 프로젝트의 큰 구획 주석은 다음 질문에 답하도록 작성했습니다.

1. 이 상태/함수는 사용자 행동 중 어느 단계인가?
2. 서버·DB·localStorage 중 어디에 저장되는가?
3. 같은 기능을 다시 눌렀을 때 안전한가?
4. 실패하면 사용자에게 어떤 메시지가 보이는가?

---

## 5. 변경 후 검증 순서

```bash
npm run test       # 순수 로직 회귀 검사
npm run typecheck  # TypeScript 타입 검사
npm run build      # 실제 배포 빌드 검사
```

그 다음 브라우저에서 최소한 아래를 확인합니다.

- 사용자 선택 → 과목 선택 유지
- 한국사 키워드 기본데이터 최초/반복 적재
- 키워드 학습 1세션 완료와 통계 반영
- 기출문제 1세션 완료와 오답 다시 풀기
- 데이터 직접 추가·수정·삭제

실패 지점은 브라우저 Console보다 먼저 Network 응답의 상태 코드와 `error` JSON을 확인하면
대부분 빠르게 찾을 수 있습니다.
