-- ════════════════════════════════════════════════════════════
-- EventHub Supabase 스키마
-- Supabase 프로젝트 생성 후, SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
-- ════════════════════════════════════════════════════════════

-- 1. 이벤트 (기존 EVENTS 배열을 대체)
create table events (
  id text primary key,                    -- 예: "e001"
  category text not null,                 -- fashion/beauty/food/tech/delivery/stay/living/popup
  brand text not null,
  merchant_type text not null default '브랜드',  -- '브랜드' | '소상공인'
  is_verified_real boolean not null default false,
  lat double precision, -- nullable: 매장 없이 전국 온라인으로 진행되는 이벤트는 좌표 없음 (내 주변 섹션에서 자동 제외됨)
  lng double precision, -- nullable: 위와 동일
  title text not null,
  subtitle text,
  discount text not null,
  period text not null,                   -- "2026.07.01 - 2026.07.31" 형태 (기존 프론트 호환용)
  period_start date,                      -- 정렬/만료 체크용 실제 날짜
  period_end date,
  channel text,
  "desc" text,
  tags text[] default '{}',
  image text,
  domain text,
  link text,
  source_url text,                        -- 실제 데이터 출처 (검증용)
  source_type text default 'unknown',     -- 'url_auto' | 'manual' | 'ai_scan'
  source_checked_at timestamptz,          -- 이 정보를 마지막으로 확인(승인)한 시각
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_events_category on events(category);
create index idx_events_period_end on events(period_end);

-- 아래 3개 컬럼도 실제로는 events.py/admin_candidates.py에서 쓰고 있는데
-- 이 파일의 create table 블록엔 누락되어 있었음. 이미 있다면 무시됨(idempotent).
alter table events add column if not exists is_active boolean not null default true;
alter table events add column if not exists conditions text;      -- 참여 조건 (나이/수량 제한 등)
alter table events add column if not exists target_audience text; -- 참여 대상
alter table events add column if not exists link_last_checked timestamptz; -- check_broken_links.py가 마지막으로 확인한 시각

-- 2. 이벤트 통계 (조회수/좋아요 — 기존 EventStats 시트 대체)
create table event_stats (
  event_id text primary key references events(id) on delete cascade,
  views integer not null default 0,
  likes integer not null default 0,
  site_visits integer not null default 0  -- 공식 사이트 이동 클릭 수 (실사용자 테스트 검증용)
);

-- 3. 문의하기 (기존 Inquiries 시트 대체)
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  name text default '익명',
  email text not null,
  message text not null,
  status text not null default '답변대기',  -- '답변대기' | '답변완료'
  created_at timestamptz default now()
);

-- 4. 관리자 승인 대기 큐 (AI가 찾은 후보 이벤트 — 승인 전까지 events에 안 들어감)
create table event_candidates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  brand text not null,
  title text not null,
  subtitle text,
  discount text,
  period text,
  period_start date,
  period_end date,
  channel text,
  "desc" text,
  tags text[] default '{}',
  domain text,
  link text,
  source_url text not null,               -- AI가 참고한 출처 URL (검수 필수)
  source_type text default 'unknown',     -- 'url_auto' | 'manual' | 'ai_scan' — 어떤 경로로 등록됐는지 자동 기록
  source_checked_at timestamptz,          -- 이 정보를 마지막으로 확인(승인)한 시각 — 승인 시 자동 기록
  ai_confidence_note text,                -- AI가 스스로 남긴 확신도/주의사항
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  found_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
-- 완전히 동일한(브랜드+제목+시작일) 후보가 실수로 중복 등록되는 것만 최소한으로 막는 안전장치.
-- 대규모 유사도 매칭 시스템이 아니라 "리터럴하게 똑같은 것"만 막는 가벼운 제약.
create unique index if not exists idx_candidates_no_exact_dup
  on event_candidates (brand, title, period_start)
  where status = 'pending';

create index idx_candidates_status on event_candidates(status);

alter table event_candidates add column if not exists image text;
alter table event_candidates add column if not exists conditions text;
alter table event_candidates add column if not exists target_audience text;

-- ── Row Level Security: 읽기는 누구나, 쓰기는 서버(service_role)만 ──
alter table events enable row level security;
alter table event_stats enable row level security;
alter table inquiries enable row level security;
alter table event_candidates enable row level security;

create policy "이벤트는 누구나 조회 가능" on events for select using (true);
create policy "통계는 누구나 조회 가능" on event_stats for select using (true);

-- 문의/후보큐는 service_role(서버)만 접근하도록 별도 정책 없이 기본 차단 상태로 둠
-- (Python 서버리스 함수는 service_role 키를 쓰므로 RLS를 우회해서 접근 가능)

-- 5. 조회수/좋아요 원자적 증감 함수 (동시 요청 시 레이스 컨디션 방지)
create or replace function increment_event_stat(p_event_id text, p_field text, p_delta integer)
returns void as $$
begin
  insert into event_stats (event_id, views, likes, site_visits)
  values (p_event_id, 0, 0, 0)
  on conflict (event_id) do nothing;

  if p_field = 'views' then
    update event_stats set views = greatest(0, views + p_delta) where event_id = p_event_id;
  elsif p_field = 'likes' then
    update event_stats set likes = greatest(0, likes + p_delta) where event_id = p_event_id;
  elsif p_field = 'site_visits' then
    update event_stats set site_visits = greatest(0, site_visits + p_delta) where event_id = p_event_id;
  end if;
end;
$$ language plpgsql;

-- ════════════════════════════════════════════════════════════
-- 6. 문서에 누락되어 있었지만 실제로는 프론트엔드(js/*.js)에서
--    직접 사용 중이던 테이블들 정리. 이 파일만 보고 DB를 새로
--    세팅하면 아래 기능(찜/팔로우/개인일정/초대/방문후기)이
--    전부 조용히 실패했을 것 — 문서-실제 괴리를 여기서 해소함.
--    이미 존재한다면 각 create table은 생략하세요 (if not exists 처리해둠).
-- ════════════════════════════════════════════════════════════

-- 찜한 이벤트 (하트 버튼) — 05-event-sheet.js, 10-auth.js
-- 실제 DB에는 합성 id 없이 (user_id, event_id) 자체가 복합키로 되어 있음.
create table if not exists user_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references events(id) on delete cascade,
  saved_at timestamptz default now(),
  primary key (user_id, event_id)
);
alter table user_saves enable row level security;
create policy "본인 찜 목록만 조회" on user_saves for select using (auth.uid() = user_id);
create policy "본인 찜만 추가" on user_saves for insert with check (auth.uid() = user_id);
create policy "본인 찜만 삭제" on user_saves for delete using (auth.uid() = user_id);

-- 팔로우한 브랜드 — 05-event-sheet.js, 11-init-misc.js, 프로필 허브
-- 마찬가지로 합성 id 없이 (user_id, brand) 복합키.
create table if not exists user_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  followed_at timestamptz default now(),
  primary key (user_id, brand)
);
alter table user_follows enable row level security;
create policy "본인 팔로우 목록만 조회" on user_follows for select using (auth.uid() = user_id);
create policy "본인 팔로우만 추가" on user_follows for insert with check (auth.uid() = user_id);
create policy "본인 팔로우만 삭제" on user_follows for delete using (auth.uid() = user_id);

-- 온보딩 관심키워드/연락 이메일 — 06-ai-recommend.js, 10-auth.js
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  keywords text[] not null default '{}',
  contact_email text,
  onboarded_at timestamptz default now()
);
alter table user_preferences enable row level security;
create policy "본인 설정만 조회" on user_preferences for select using (auth.uid() = user_id);
create policy "본인 설정만 저장" on user_preferences for insert with check (auth.uid() = user_id);
create policy "본인 설정만 수정" on user_preferences for update using (auth.uid() = user_id);

-- EventHub 자체 캘린더의 개인 일정 — 09-calendar.js
create table if not exists user_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  schedule_date date not null,
  start_time time,
  end_time time,
  title text not null,
  memo text,
  created_at timestamptz default now()
);
alter table user_schedules enable row level security;
create policy "본인 일정만 조회" on user_schedules for select using (auth.uid() = user_id);
create policy "본인 일정만 추가" on user_schedules for insert with check (auth.uid() = user_id);
create policy "본인 일정만 삭제" on user_schedules for delete using (auth.uid() = user_id);

-- 친구초대 코드 — 10-auth.js
-- invited_by: 이 사람을 초대한 사람의 코드 (가입 시 기록, 없으면 자체 유입)
create table if not exists user_referrals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  invited_by text,
  created_at timestamptz default now()
);
alter table user_referrals enable row level security;
create policy "본인 초대코드만 조회" on user_referrals for select using (auth.uid() = user_id);
create policy "본인 초대코드만 생성" on user_referrals for insert with check (auth.uid() = user_id);

-- 다녀온 사람들의 한줄평 — 05-event-sheet.js (상세페이지 후기 섹션)
-- 본인 것만 쓸 수 있지만, 조회는 다른 사람 것도 봐야 하는 게 후기 기능의 본질이라 select는 전체 공개.
create table if not exists event_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_id text references events(id) on delete cascade,
  comment text,
  visited_at timestamptz default now(),
  unique (user_id, event_id)
);
alter table event_visits enable row level security;
create policy "방문 후기는 누구나 조회 가능" on event_visits for select using (true);
create policy "본인 후기만 작성" on event_visits for insert with check (auth.uid() = user_id);
create policy "본인 후기만 수정" on event_visits for update using (auth.uid() = user_id);

-- 하단 고정탭 클릭 집계 (어느 탭이 실제로 많이 눌리는지 데이터로 확인하기 위함 —
-- Home을 중앙에 배치한 결정을 나중에 데이터로 검증할 수 있게).
-- 개인별 추적이 아니라 탭별 합산 카운트만 남기므로 user_id 없이 가볍게 설계.
create table if not exists nav_click_stats (
  tab_name text primary key,
  click_count bigint not null default 0,
  updated_at timestamptz default now()
);
-- 쓰기는 서버(service_role)만 하므로 RLS는 조회만 공개 정책을 둠
alter table nav_click_stats enable row level security;
create policy "탭 클릭 집계는 누구나 조회 가능" on nav_click_stats for select using (true);

create or replace function increment_nav_click(p_tab text)
returns void as $$
begin
  insert into nav_click_stats (tab_name, click_count, updated_at)
  values (p_tab, 1, now())
  on conflict (tab_name) do update
    set click_count = nav_click_stats.click_count + 1, updated_at = now();
end;
$$ language plpgsql;

-- ════════════════════════════════════════════════════════════
-- 7. 집계용 뷰 (view) — 실제 Supabase 스키마 덤프에서 발견됨.
--    코드(js/*.py, api/*.py) grep만으로는 안 잡혔던 것들 — 아마 관리자가
--    대시보드에서 직접 참고하거나, 프론트 어딘가에서 조회수/찜수/추천 성과를
--    보여줄 때 쓰는 것으로 추정. 정확한 정의(어떤 컬럼을 group by 하는지)는
--    실제 DB에 이미 있는 걸 그대로 문서화하는 목적이라 아래는 추정 재현입니다 —
--    실제 뷰 정의와 다르면 Supabase 대시보드에서 뷰 SQL을 확인해 이 부분만 교체해주세요.
-- ════════════════════════════════════════════════════════════

create or replace view event_save_counts as
select event_id, count(*) as save_count
from user_saves
group by event_id;

create or replace view event_visit_counts as
select event_id, count(*) as visit_count
from event_visits
where event_id is not null
group by event_id;

create or replace view referral_counts as
select invited_by as referral_code, count(*) as invited_count
from user_referrals
where invited_by is not null
group by invited_by;