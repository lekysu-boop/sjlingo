-- ============================================================================
--  중복 등록된 사용자(profiles) 정리
-- ----------------------------------------------------------------------------
--  등록 버튼에 중복 클릭 방지가 없던 버그로, 같은 이름의 사용자가 짧은 시간
--  간격으로 두 번 생성된 경우가 있었습니다 (app/page.tsx 수정으로 재발은 막았습니다).
--  이 스크립트는 이름이 같은(대소문자·앞뒤 공백 무시) 프로필 그룹에서
--  키워드/기출문제가 더 많이 등록된(실제로 쓰인) 프로필만 남기고
--  나머지는 삭제 대상으로 표시합니다. 동점이면 먼저 만들어진 쪽을 남깁니다.
--
--  profiles.id 는 subjects/keywords/exam_questions/study_sessions 에서
--  ON DELETE CASCADE 로 걸려 있어, 삭제되는 프로필의 하위 데이터도 함께 정리됩니다.
-- ============================================================================

-- 1) 먼저 이 SELECT로 "삭제될 행"을 눈으로 확인하세요.
with ranked as (
  select
    p.id,
    p.name,
    p.created_at,
    (select count(*) from keywords k where k.owner_id = p.id) as kw_count,
    (select count(*) from exam_questions e where e.owner_id = p.id) as ex_count,
    row_number() over (
      partition by lower(trim(p.name))
      order by
        (select count(*) from keywords k where k.owner_id = p.id) desc,
        (select count(*) from exam_questions e where e.owner_id = p.id) desc,
        p.created_at asc
    ) as rn
  from profiles p
)
select id, name, created_at, kw_count, ex_count
from ranked
where rn > 1
order by name, created_at;

-- 2) 위 결과가 맞으면 아래 DELETE의 주석(--)을 지우고 실행하세요.
-- with ranked as (
--   select
--     p.id,
--     row_number() over (
--       partition by lower(trim(p.name))
--       order by
--         (select count(*) from keywords k where k.owner_id = p.id) desc,
--         (select count(*) from exam_questions e where e.owner_id = p.id) desc,
--         p.created_at asc
--     ) as rn
--   from profiles p
-- )
-- delete from profiles
-- where id in (select id from ranked where rn > 1);
