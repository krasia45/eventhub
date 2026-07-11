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
  lat double precision not null,
  lng double precision not null,
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_events_category on events(category);
create index idx_events_period_end on events(period_end);

-- 2. 이벤트 통계 (조회수/좋아요 — 기존 EventStats 시트 대체)
create table event_stats (
  event_id text primary key references events(id) on delete cascade,
  views integer not null default 0,
  likes integer not null default 0
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
  desc text,
  tags text[] default '{}',
  domain text,
  link text,
  source_url text not null,               -- AI가 참고한 출처 URL (검수 필수)
  ai_confidence_note text,                -- AI가 스스로 남긴 확신도/주의사항
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  found_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index idx_candidates_status on event_candidates(status);

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
  insert into event_stats (event_id, views, likes)
  values (p_event_id, 0, 0)
  on conflict (event_id) do nothing;

  if p_field = 'views' then
    update event_stats set views = greatest(0, views + p_delta) where event_id = p_event_id;
  elsif p_field = 'likes' then
    update event_stats set likes = greatest(0, likes + p_delta) where event_id = p_event_id;
  end if;
end;
$$ language plpgsql;
