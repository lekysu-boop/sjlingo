# DATABASE.md — 데이터베이스(DBMS) 관리 가이드

> 대상: Oracle/MSSQL 을 SQL*Plus, SSMS, 토드(Toad) 등으로 관리해 본 분.
> 이 프로젝트의 DB 는 **Supabase 가 관리해 주는 PostgreSQL** 입니다.
> "PostgreSQL = 오픈소스 Oracle" 정도로 생각하면 됩니다. SQL 문법도 대부분 비슷합니다.

---

## 1. 어떤 툴로 관리하나? (결론부터)

| 용도 | 추천 툴 | 비유 |
|---|---|---|
| **평소 대부분의 작업** | Supabase 웹 대시보드 (SQL Editor + Table Editor) | 웹 기반 SSMS/토드 |
| 데이터 눈으로 보고 셀 단위 수정 | Supabase **Table Editor** | SSMS 의 "테이블 열기" |
| DDL/DML 스크립트 실행 | Supabase **SQL Editor** | SQL*Plus / 쿼리 창 |
| 로컬 전문 툴을 쓰고 싶을 때 | **DBeaver** (무료) 로 직접 접속 | 토드/오렌지 |

**추천**: 처음에는 Supabase 웹 대시보드만으로 충분합니다. 설치가 없고, 백업·권한도
같은 화면에서 처리됩니다. 쿼리를 많이 다루게 되면 그때 DBeaver 를 붙이세요.

---

## 2. Supabase SQL Editor — DDL/DML 실행 (SQL*Plus 자리)

접속: https://supabase.com → 내 프로젝트 → 왼쪽 메뉴 **SQL Editor** → **New query**

### DDL (테이블 생성·변경)
이 프로젝트의 전체 스키마는 `supabase/schema.sql` 한 파일입니다.
처음 셋업할 때 이 파일 전체를 붙여넣고 **RUN** 하면 끝입니다.

컬럼 추가 같은 변경도 똑같이 SQL Editor 에서:
```sql
-- 예: keywords 테이블에 메모 컬럼 추가
alter table keywords add column memo text not null default '';
```
> ⚠️ 스키마를 바꾸면 **`supabase/schema.sql` 파일에도 같은 내용을 반영**해 두세요.
> 그래야 새 환경(다른 Supabase 프로젝트)에서 스키마를 다시 만들 수 있습니다.
> (Oracle 시절 DDL 스크립트를 형상관리하던 것과 같은 습관입니다.)

### DML (조회·수정·삭제)
Oracle 과 거의 같은 문법입니다:
```sql
-- 사용자별 키워드 개수
select p.name, count(k.id)
from profiles p
left join keywords k on k.owner_id = p.id
group by p.name;

-- 특정 사용자의 오답(복습 대상) 키워드
select k.code, k.concept
from keyword_progress g
join keywords k on k.id = g.keyword_id
where g.wrong = true
  and g.owner_id = '사용자UUID';

-- 잘못 들어간 데이터 삭제
delete from keywords where code = '테스트';
```

PostgreSQL 에서 Oracle 과 다른 점 몇 가지:
| Oracle | PostgreSQL |
|---|---|
| `NVL(a, b)` | `COALESCE(a, b)` |
| `SYSDATE` | `now()` |
| `ROWNUM <= 10` | `LIMIT 10` |
| `VARCHAR2` | `text` (길이 제한 없이 흔히 사용) |
| 시퀀스로 PK 채번 | `uuid` + `gen_random_uuid()` (이 프로젝트 방식) |
| `MERGE` | `INSERT ... ON CONFLICT` (upsert) |

---

## 3. Supabase Table Editor — 데이터 눈으로 보기/수정

왼쪽 메뉴 **Table Editor** → 테이블 선택.

- 엑셀처럼 행이 보이고, **셀을 더블클릭해 직접 수정**할 수 있습니다.
- **Insert row** 버튼으로 행 추가, 행 선택 후 Delete 로 삭제.
- **Filter/Sort** 버튼으로 조건 조회 (간단한 WHERE 절).
- 개발 중 "데이터가 진짜 들어갔나?" 확인할 때 가장 빠릅니다.

> 주의: 여기서 직접 고친 내용은 앱의 중복 검사(dedupe)를 거치지 않습니다.
> 운영 데이터는 가급적 앱 화면이나 API 로 수정하세요.

---

## 4. DBeaver 로 직접 접속 (선택 — 전문 클라이언트)

토드/SSMS 처럼 로컬 프로그램으로 관리하고 싶다면:

1. https://dbeaver.io → **Community Edition** 다운로드·설치 (무료).
2. Supabase 대시보드 → **Project Settings → Database** →
   **Connection info** (또는 상단 **Connect** 버튼) 에서 접속 정보 확인:
   - Host: `aws-0-ap-northeast-2.pooler.supabase.com` 형태
   - Port: `5432` (Session mode) 또는 `6543` (Transaction pooler)
   - Database: `postgres` / User: `postgres.xxxx` / Password: 프로젝트 만들 때 정한 것
3. DBeaver → **새 연결 → PostgreSQL** → 위 정보 입력 → Test Connection → 완료.
4. 이후 토드처럼 ERD 보기, 쿼리 실행, CSV 내보내기/가져오기 전부 가능합니다.

> 팁: 비밀번호를 잊었으면 Project Settings → Database → **Reset database password**.

---

## 5. 백업과 복구

- **Supabase 무료 플랜**: 대시보드 **Database → Backups** 에서 일 단위 자동 백업 7일 보관.
- **수동 백업(권장 습관)**: SQL Editor 에서
  ```sql
  -- 테이블별 CSV 는 Table Editor 우상단 Export 버튼이 가장 쉽습니다.
  ```
  또는 DBeaver 의 내보내기 기능으로 주요 테이블을 CSV 저장.
- **스키마 백업**: `supabase/schema.sql` 이 곧 스키마 백업입니다. GitHub 에 있으니 안전.

---

## 6. 이 프로젝트의 테이블 한눈에

| 테이블 | 역할 | 주요 컬럼 |
|---|---|---|
| `profiles` | 사용자 | name, emoji, (email·auth_* 는 이메일 로그인 확장용) |
| `subjects` | 과목 (사용자별) | owner_id, name |
| `keywords` | 암기코드 | era(시대/주제), code, concept, principle, code_norm(중복판정) |
| `exam_questions` | 기출문제 | era, question, options(jsonb 배열), answer, explain |
| `keyword_progress` | 키워드 학습 상태 | known(외움), wrong(복습 대상) |
| `exam_attempts` | 기출 풀이 이력 | question_id, correct, created_at |
| `keyword_events` | 키워드 학습 이력(월간 집계용) | known, created_at |
| `cheers` | 응원 | to_id, from_id |
| `gamify_state` | 게이미피케이션 상태 | streak, today_xp, hearts, coins |
| `league_scores` | 주간 리그 점수 | week_start, xp |

관계: `profiles 1 ─ N subjects 1 ─ N keywords/exam_questions`,
학습 기록 테이블들은 전부 `owner_id → profiles.id` 를 가리킵니다.
모든 FK 에 `on delete cascade` 가 걸려 있어 사용자를 지우면 그 데이터도 함께 지워집니다.

---

## 7. RLS(행 단위 보안) — 이 프로젝트에서 알아야 할 것

- 모든 테이블에 **RLS 가 켜져 있고 정책이 없습니다** → 브라우저(anon 키)로는 접근 불가.
- 서버 API 만 `service_role` 키로 접근합니다 (RLS 우회). 소유권 검사는 API 코드가 담당.
- 즉 **"DB 는 서버 API 를 통해서만 만진다"** 가 이 프로젝트의 보안 모델입니다.
- SQL Editor/DBeaver 는 관리자 권한이므로 RLS 와 무관하게 모두 보입니다.

---

## 다음 문서
- 처음 셋업 → `GETTING_STARTED.md` STEP 4 (Supabase 만들기)
- 스키마 파일 → `supabase/schema.sql` (모든 테이블 정의 + 주석)
- 배포 → `DEPLOY.md`
