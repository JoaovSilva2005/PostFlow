PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(email)) >= 5),
  CHECK (length(trim(display_name)) >= 2)
);

CREATE TABLE brands (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  segment TEXT NOT NULL,
  tone_of_voice TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#4F46E5',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CHECK (length(trim(name)) >= 2),
  CHECK (primary_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE social_platforms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  character_limit INTEGER NOT NULL,
  CHECK (character_limit > 0)
);

CREATE TABLE post_drafts (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  caption TEXT NOT NULL,
  visual_text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4F46E5',
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE CASCADE,
  FOREIGN KEY (platform_id) REFERENCES social_platforms (id) ON DELETE RESTRICT,
  CHECK (length(trim(title)) >= 3),
  CHECK (status IN ('draft', 'scheduled', 'published')),
  CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE post_hashtags (
  post_id INTEGER NOT NULL,
  hashtag TEXT NOT NULL,
  PRIMARY KEY (post_id, hashtag),
  FOREIGN KEY (post_id) REFERENCES post_drafts (id) ON DELETE CASCADE,
  CHECK (substr(hashtag, 1, 1) = '#'),
  CHECK (length(hashtag) >= 2)
);

CREATE INDEX idx_brands_user_id ON brands (user_id);
CREATE INDEX idx_post_drafts_brand_id ON post_drafts (brand_id);
CREATE INDEX idx_post_drafts_platform_id ON post_drafts (platform_id);
CREATE INDEX idx_post_drafts_scheduled_at ON post_drafts (scheduled_at);
CREATE INDEX idx_post_drafts_status ON post_drafts (status);
