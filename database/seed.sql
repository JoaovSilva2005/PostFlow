-- PostFlow - massa inicial de testes para PostgreSQL/Supabase
-- Execute este arquivo depois de database/schema.sql.

begin;

insert into public.users (id, email, display_name) values
  (
    '00000000-0000-0000-0000-000000000001',
    'aluno@postflow.com',
    'Aluno PostFlow'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'contato@cafeaurora.com',
    'Marina Costa'
  )
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name;

insert into public.brands (
  id,
  user_id,
  name,
  segment,
  tone_of_voice,
  primary_color
) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'PostFlow Demo',
    'Tecnologia',
    'Profissional e objetivo',
    '#4F46E5'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Café Aurora',
    'Alimentação e bebidas',
    'Próximo e acolhedor',
    '#F97316'
  )
on conflict (id) do update set
  name = excluded.name,
  segment = excluded.segment,
  tone_of_voice = excluded.tone_of_voice,
  primary_color = excluded.primary_color;

insert into public.social_platforms (id, name, character_limit) values
  ('20000000-0000-0000-0000-000000000001', 'Instagram', 2200),
  ('20000000-0000-0000-0000-000000000002', 'LinkedIn', 3000),
  ('20000000-0000-0000-0000-000000000003', 'Facebook', 63206)
on conflict (id) do update set
  name = excluded.name,
  character_limit = excluded.character_limit;

insert into public.post_drafts (
  id,
  brand_id,
  platform_id,
  title,
  caption,
  visual_text,
  color,
  scheduled_at,
  status
) values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Planejamento com inteligência',
    'Organize suas ideias e mantenha o conteúdo da sua marca no ritmo certo.',
    'Planeje. Crie. Publique.',
    '#4F46E5',
    '2026-08-25 14:00:00+00',
    'draft'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'Bastidores do PostFlow',
    'Conheça o fluxo que transforma uma ideia em conteúdo organizado.',
    'Ideias em movimento.',
    '#4F46E5',
    '2026-08-28 09:00:00+00',
    'scheduled'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'Sexta com café especial',
    'Transforme sua pausa em um momento especial com o Café Aurora.',
    'Uma pausa que inspira.',
    '#F97316',
    '2026-08-29 10:00:00+00',
    'draft'
  )
on conflict (id) do update set
  title = excluded.title,
  caption = excluded.caption,
  visual_text = excluded.visual_text,
  color = excluded.color,
  scheduled_at = excluded.scheduled_at,
  status = excluded.status;

insert into public.post_hashtags (post_id, hashtag) values
  ('30000000-0000-0000-0000-000000000001', '#ConteudoCriativo'),
  ('30000000-0000-0000-0000-000000000001', '#PostFlow'),
  ('30000000-0000-0000-0000-000000000002', '#Bastidores'),
  ('30000000-0000-0000-0000-000000000002', '#PostFlow'),
  ('30000000-0000-0000-0000-000000000003', '#CafeAurora'),
  ('30000000-0000-0000-0000-000000000003', '#CafeEspecial'),
  ('30000000-0000-0000-0000-000000000003', '#Sextou')
on conflict (post_id, hashtag) do nothing;

insert into public.financial_transactions (
  id,
  brand_id,
  type,
  category,
  description,
  amount,
  due_date,
  status,
  paid_at
) values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'income',
    'Assinaturas',
    'Receita mensal dos planos PostFlow',
    3500.00,
    '2026-09-05',
    'paid',
    '2026-09-05 12:00:00+00'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'expense',
    'Infraestrutura',
    'Serviços de hospedagem e banco de dados',
    800.00,
    '2026-09-08',
    'paid',
    '2026-09-08 15:30:00+00'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'expense',
    'Marketing',
    'Campanha de divulgação do produto',
    450.00,
    '2026-09-20',
    'pending',
    null
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'income',
    'Serviços',
    'Consultoria de conteúdo para cliente',
    1200.00,
    '2026-09-25',
    'pending',
    null
  )
on conflict (id) do update set
  type = excluded.type,
  category = excluded.category,
  description = excluded.description,
  amount = excluded.amount,
  due_date = excluded.due_date,
  status = excluded.status,
  paid_at = excluded.paid_at;

commit;
