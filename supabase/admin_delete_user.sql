-- ============================================================================
--  사용자 삭제 (연관 데이터 전부 함께 삭제)
-- ----------------------------------------------------------------------------
--  아래 DO 블록의 target_name 딱 한 곳에만 이름을 넣으면, profiles를 포함해
--  그 사용자와 관련된 모든 테이블의 행을 자식 → 부모 순서로 명시적으로 삭제합니다.
--  (schema.sql의 on delete cascade에 기대지 않고 모든 테이블을 직접 지웁니다.)
--
--  삭제 대상: subjects, keywords, exam_questions, keyword_progress,
--            exam_attempts, keyword_events, study_sessions, gamify_state,
--            league_scores, cheers(받은 응원)
--  cheers(보낸 응원)은 다른 사람의 기록이라 삭제하지 않고 from_id만 비웁니다.
--
--  주의: 이름이 같은 사용자가 여러 명이면 전부 삭제됩니다. 먼저 0)으로
--        몇 명이 해당하는지 확인하세요.
--  사용법: Supabase 대시보드 > SQL Editor 에서 순서대로 실행하세요.
-- ============================================================================

-- 0) 삭제 전 미리보기 — 이름만 바꿔서 실행. 몇 명인지, 데이터가 얼마나 있는지 확인합니다.
select
  p.id,
  p.name,
  p.created_at,
  (select count(*) from subjects        s  where s.owner_id  = p.id) as subjects,
  (select count(*) from keywords        k  where k.owner_id  = p.id) as keywords,
  (select count(*) from exam_questions  e  where e.owner_id  = p.id) as exam_questions,
  (select count(*) from study_sessions  ss where ss.owner_id = p.id) as study_sessions
from profiles p
where p.name = '여기에_이름';

-- 1) 위 결과가 맞으면, 아래 target_name의 이름만 바꿔서 이 블록 전체를 실행하세요.
do $$
declare
  target_name text := '여기에_이름';  -- ← 여기 이름만 바꾸면 됩니다
  target_ids uuid[];
begin
  select array_agg(id) into target_ids from profiles where name = target_name;

  if target_ids is null or array_length(target_ids, 1) = 0 then
    raise notice '이름 "%"에 해당하는 사용자를 찾지 못했습니다.', target_name;
    return;
  end if;

  raise notice '삭제 대상 %명 (id: %)', array_length(target_ids, 1), target_ids;

  delete from keyword_progress where owner_id = any(target_ids);
  delete from exam_attempts    where owner_id = any(target_ids);
  delete from keyword_events   where owner_id = any(target_ids);
  delete from study_sessions   where owner_id = any(target_ids);
  delete from gamify_state     where owner_id = any(target_ids);
  delete from league_scores    where owner_id = any(target_ids);
  update cheers set from_id = null where from_id = any(target_ids);
  delete from cheers           where to_id = any(target_ids);
  delete from keywords         where owner_id = any(target_ids);
  delete from exam_questions   where owner_id = any(target_ids);
  delete from subjects         where owner_id = any(target_ids);
  delete from profiles         where id = any(target_ids);

  raise notice '삭제 완료';
end $$;
