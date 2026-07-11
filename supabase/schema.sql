-- ============================================================
--  암기 마스터 — Supabase (PostgreSQL) 스키마
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
--  [사용자] profiles
--  Oracle/MSSQL 로 치면 USERS 테이블입니다.
--  현재는 "이름만 골라 시작"하는 가벼운 로그인이지만,
--  나중에 이메일/비밀번호 인증으로 확장할 수 있도록 컬럼을 미리 넣어 뒀습니다.
--
--  * id          : PK. 숫자 시퀀스(Oracle SEQUENCE) 대신 UUID를 씁니다.
--                  분산 환경에서 충돌이 없고 URL에 노출돼도 추측이 어렵습니다.
--  * name        : 화면에 보이는 이름 (지금 로그인에 사용)
--  * email       : 이메일 인증으로 확장할 때 사용. 지금은 NULL 허용.
--                  UNIQUE 제약이 있어 한 이메일당 한 계정만 가능.
--  * auth_provider : 'guest'(지금) / 'email' / 'google' ... 인증 방식 구분.
--                  Spring Security 의 authentication provider 개념과 같습니다.
--  * auth_user_id: 나중에 Supabase Auth(auth.users)의 id를 여기에 연결합니다.
--                  지금은 NULL. (아래 "옵션 B" 주석 참고)
--  * created_at  : 가입 시각. timestamptz = timezone 포함 타임스탬프.
-- ============================================================
create table if not exists profiles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text unique,                       -- 이메일 인증 확장용 (지금은 비워둠)
  auth_provider text not null default 'guest',     -- guest | email | google | ...
  auth_user_id  uuid,                              -- 나중에 auth.users.id 와 연결
  -- password_hash : 이메일+비밀번호 로그인용. 비밀번호 "원문"은 절대 저장하지 않고,
  --   bcrypt 로 단방향 해싱한 값만 저장합니다. (Spring Security 의 BCryptPasswordEncoder 와 동일 개념)
  --   guest 사용자는 비워 둡니다.
  password_hash text,
  emoji         text not null default '🦊',
  color         text not null default '#2563eb',
  created_at    timestamptz not null default now()
);
-- 이메일로 사용자를 빨리 찾기 위한 인덱스 (로그인 조회 성능)
create index if not exists idx_profiles_email on profiles(email);

-- ---------- 과목 (사용자별 소유) ----------
create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  name       text not null,
  emoji      text not null default '📚',
  color      text not null default '#2563eb',
  created_at timestamptz not null default now()
);
create index if not exists idx_subjects_owner on subjects(owner_id);

-- ---------- 키워드(암기코드) ----------
create table if not exists keywords (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  era         text not null default '기타',   -- 학습범위(시대/주제). 범위 칩은 이 값에서 동적 추출
  code        text not null,                    -- 앞면 암기코드
  concept     text not null default '',         -- 역사적 핵심 개념
  principle   text not null default '',         -- 연상법·부가 설명
  day         text not null default '',         -- 회차/단원(선택)
  importance  int  not null default 2 check (importance between 1 and 3), -- 중요도 1=하 2=중 3=상
  code_norm   text generated always as (regexp_replace(code, '[[:space:]/]', '', 'g')) stored, -- 중복판정용 정규화
  created_at  timestamptz not null default now()
);
create index if not exists idx_keywords_scope on keywords(owner_id, subject_id);
-- 같은 사용자+과목 내에서 정규화된 암기코드가 같으면 중복 → DB 레벨에서도 차단
create unique index if not exists uq_keywords_dedupe on keywords(owner_id, subject_id, code_norm);

-- ---------- 기출문제 ----------
create table if not exists exam_questions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  era         text not null default '기타',
  question    text not null,
  options     jsonb not null default '[]'::jsonb,  -- ["보기1","보기2",...]
  answer      int  not null default 0,             -- 정답 index (0-based)
  explain     text not null default '',
  importance  int  not null default 2 check (importance between 1 and 3), -- 중요도 1=하 2=중 3=상
  created_at  timestamptz not null default now()
);
create index if not exists idx_exams_scope on exam_questions(owner_id, subject_id);

-- ---------- 키워드 학습 상태 (외웠음 / 복습대상) ----------
create table if not exists keyword_progress (
  owner_id    uuid not null references profiles(id) on delete cascade,
  keyword_id  uuid not null references keywords(id) on delete cascade,
  known       boolean not null default false,
  wrong       boolean not null default false,   -- 복습함(못 외운 것만) 대상
  updated_at  timestamptz not null default now(),
  primary key (owner_id, keyword_id)
);

-- ---------- 기출 풀이 기록 (통계·월간·오답 반복의 원천) ----------
create table if not exists exam_attempts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references exam_questions(id) on delete cascade,
  correct     boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_attempts_owner_time on exam_attempts(owner_id, created_at);

-- ---------- 키워드 학습 이벤트 (월간 학습량 집계용) ----------
create table if not exists keyword_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  known       boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_kwevents_owner_time on keyword_events(owner_id, created_at);

-- ---------- 학습 세션 기록 (공부시간·가중평균 정답률의 원천) ----------
-- 한 번의 학습 세션이 끝날 때마다 1행. duration_sec = 실제 문제 푼 시간(초).
create table if not exists study_sessions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  subject_id   uuid not null references subjects(id) on delete cascade,
  kind         text not null check (kind in ('kw', 'ex')),  -- kw=키워드, ex=기출
  total        int  not null default 0,
  correct      int  not null default 0,
  duration_sec int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_sessions_owner_time on study_sessions(owner_id, created_at);
create index if not exists idx_sessions_subject on study_sessions(owner_id, subject_id);

-- ---------- 응원 ----------
create table if not exists cheers (
  id          uuid primary key default gen_random_uuid(),
  to_id       uuid not null references profiles(id) on delete cascade,
  from_id     uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_cheers_to on cheers(to_id);

-- ---------- 게이미피케이션: 사용자 상태 (스트릭·XP·하트·코인) ----------
create table if not exists gamify_state (
  owner_id        uuid primary key references profiles(id) on delete cascade,
  streak          int  not null default 0,      -- 연속 학습일
  last_active     date,                          -- 마지막 학습일(스트릭 판정용)
  freezes         int  not null default 0,       -- 스트릭 프리즈 보유 수
  total_xp        int  not null default 0,       -- 누적 XP (리그 순위)
  today_xp        int  not null default 0,       -- 오늘 획득 XP (일일 목표 링)
  today_date      date,                          -- today_xp 기준 날짜
  daily_goal      int  not null default 100,     -- 일일 XP 목표
  hearts          int  not null default 5,       -- 남은 하트(생명)
  hearts_updated  timestamptz not null default now(), -- 하트 회복 계산 기준
  coins           int  not null default 0,
  updated_at      timestamptz not null default now()
);

-- ---------- 게이미피케이션: 주간 리그 XP (리더보드) ----------
create table if not exists league_scores (
  owner_id     uuid not null references profiles(id) on delete cascade,
  week_start   date not null,                    -- 그 주 월요일
  xp           int  not null default 0,
  league_tier  text not null default 'gold',     -- bronze/silver/gold/...
  primary key (owner_id, week_start)
);
create index if not exists idx_league_week on league_scores(week_start);

-- ============================================================
--  RLS (행 단위 보안)
--  현재(가벼운 모드): 모든 접근은 서버 API가 service_role 키로 수행하므로
--  anon(브라우저 직접 접근)은 전면 차단합니다. service_role은 RLS를 우회합니다.
-- ============================================================
alter table profiles        enable row level security;
alter table subjects        enable row level security;
alter table keywords        enable row level security;
alter table exam_questions  enable row level security;
alter table keyword_progress enable row level security;
alter table exam_attempts   enable row level security;
alter table study_sessions  enable row level security;
alter table keyword_events  enable row level security;
alter table cheers          enable row level security;
alter table gamify_state    enable row level security;
alter table league_scores   enable row level security;
-- (정책을 만들지 않으면 anon 접근은 기본 거부됨)

-- ============================================================
--  [옵션 B] 이메일/소셜 인증으로 승격하는 방법 (지금은 안 해도 됨)
--
--  현재: auth_provider='guest', 이름만으로 로그인. 서버 API가 service_role
--        키로 DB에 접근하고 owner_id로 소유권을 강제합니다.
--
--  승격 절차 (나중에):
--   1) Supabase 대시보드 > Authentication 에서 Email 로그인을 켭니다.
--   2) 회원가입 시 profiles 에 email, auth_provider='email',
--      auth_user_id = (Supabase Auth가 발급한 auth.users.id) 를 채웁니다.
--   3) 아래 RLS 정책을 추가하면, 서버 service_role 없이도
--      "로그인한 본인 데이터만" 안전하게 접근하게 됩니다.
--
--      create policy "본인 데이터만" on keywords
--        for all using (
--          owner_id in (select id from profiles where auth_user_id = auth.uid())
--        );
--      (subjects, exam_questions, *_progress, attempts, events, gamify_state,
--       league_scores 도 동일 패턴)
--
--  즉, UI(이름 선택 화면)는 그대로 두고 DB/API만 이메일 인증을 받을 수 있게
--  설계돼 있습니다. 지금 당장은 아무것도 바꿀 필요가 없습니다.
-- ============================================================
