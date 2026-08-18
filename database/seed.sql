PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT INTO users (id, email, display_name, created_at) VALUES
  (1, 'aluno@postflow.com', 'Aluno PostFlow', '2026-08-18 18:00:00'),
  (2, 'contato@cafeaurora.com', 'Marina Costa', '2026-08-18 18:05:00');

INSERT INTO brands (
  id,
  user_id,
  name,
  segment,
  tone_of_voice,
  primary_color,
  created_at,
  updated_at
) VALUES
  (1, 1, 'PostFlow Demo', 'Tecnologia', 'Profissional e objetivo', '#4F46E5', '2026-08-18 18:10:00', '2026-08-18 18:10:00'),
  (2, 2, 'Café Aurora', 'Alimentação e bebidas', 'Próximo e acolhedor', '#F97316', '2026-08-18 18:15:00', '2026-08-18 18:15:00');

INSERT INTO social_platforms (id, name, character_limit) VALUES
  (1, 'Instagram', 2200),
  (2, 'LinkedIn', 3000),
  (3, 'Facebook', 63206);

INSERT INTO post_drafts (
  id,
  brand_id,
  platform_id,
  title,
  caption,
  visual_text,
  color,
  scheduled_at,
  status,
  created_at,
  updated_at
) VALUES
  (1, 2, 1, 'Sexta com café especial', 'Transforme sua pausa em um momento especial com o Café Aurora.', 'Uma pausa que inspira.', '#F97316', '2026-08-21 10:00:00', 'draft', '2026-08-18 18:20:00', '2026-08-18 18:20:00'),
  (2, 2, 2, 'Bastidores do Café Aurora', 'Conheça as pessoas e os cuidados por trás de cada xícara.', 'Feito por pessoas.', '#F97316', '2026-08-24 09:00:00', 'scheduled', '2026-08-18 18:25:00', '2026-08-18 18:25:00'),
  (3, 1, 1, 'Planejamento com inteligência', 'Organize suas ideias e mantenha o conteúdo da sua marca no ritmo certo.', 'Planeje. Crie. Publique.', '#4F46E5', '2026-08-25 14:00:00', 'draft', '2026-08-18 18:30:00', '2026-08-18 18:30:00');

INSERT INTO post_hashtags (post_id, hashtag) VALUES
  (1, '#CafeAurora'),
  (1, '#CafeEspecial'),
  (1, '#Sextou'),
  (2, '#Bastidores'),
  (2, '#FeitoComCarinho'),
  (3, '#ConteudoCriativo'),
  (3, '#PostFlow');

COMMIT;
