-- ============================================================
--  [마이그레이션] 중요도(importance) 컬럼 추가
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
-- ------------------------------------------------------------
--  키워드/기출문제에 중요도(1=하, 2=중, 3=상)를 붙입니다.
--  학습 시작 화면에서 "★★★만 / ★★ 이상" 처럼 골라서 풀 수 있습니다.
--  기존 데이터는 모두 2(중)로 시작합니다.
-- ============================================================
alter table keywords       add column if not exists importance int not null default 2 check (importance between 1 and 3);
alter table exam_questions add column if not exists importance int not null default 2 check (importance between 1 and 3);
