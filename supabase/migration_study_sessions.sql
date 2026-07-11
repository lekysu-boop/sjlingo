-- ============================================================
--  [마이그레이션] study_sessions — 학습 세션 기록 (공부시간·정답률)
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--  (기존 schema.sql 을 이미 실행한 프로젝트에 추가로 적용하는 파일)
-- ------------------------------------------------------------
--  한 번의 학습 세션(키워드 N개 / 기출 N문항)이 끝날 때마다 1행씩 쌓입니다.
--   - duration_sec : 실제로 문제를 푼 시간(초). 통계 화면의 "공부시간" 원천.
--   - total/correct: 세션 크기와 정답 수. 통계의 "가중평균 정답률" 원천
--     (세션 크기 total 이 가중치가 되어, 많이 푼 세션이 평균에 더 크게 반영됨)
--   - subject_id   : 과목별 통계 분리의 기준.
-- ============================================================
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
alter table study_sessions enable row level security;
