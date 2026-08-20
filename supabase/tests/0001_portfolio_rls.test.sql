begin;
select plan(6);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

insert into public.portfolios (id, user_id, title, bio, slug, is_published)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Draft', 'Private portfolio', 'owner-draft', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Public', 'Published portfolio', 'owner-public', true);

set local role anon;
select results_eq(
  $$select slug from public.portfolios order by slug$$,
  array['owner-public'],
  'Anonymous visitors see only published portfolios'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select slug from public.portfolios order by slug$$,
  array['owner-draft', 'owner-public'],
  'The owner sees published and draft portfolios'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select results_eq(
  $$select slug from public.portfolios order by slug$$,
  array['owner-public'],
  'Another user cannot read the owner draft'
);

select is_empty(
  $$update public.portfolios set title = 'Stolen' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id$$,
  'Another user cannot update the owner draft'
);

select is_empty(
  $$delete from public.portfolios where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id$$,
  'Another user cannot delete the owner draft'
);

set local role anon;
select throws_ok(
  $$insert into public.portfolios (user_id, title, bio, slug) values ('11111111-1111-1111-1111-111111111111', 'Bad', 'Bad', 'anon-write')$$,
  '42501',
  null,
  'Anonymous visitors cannot create portfolios'
);

select * from finish();
rollback;
