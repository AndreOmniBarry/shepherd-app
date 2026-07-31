-- ============================================================
-- Church Feed — one church-wide urgent/general feed everyone can read,
-- plus at most one feed group per department (HOD-created, strictly
-- dept-specific), with a lightweight comment + acknowledge model. Kept
-- deliberately simple (post/comment/acknowledge, no nested threads, no
-- real-time typing) per the "feed/board" model, not full live chat.
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN ('church', 'department')),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  branch_id     UUID REFERENCES branches(id),
  name          TEXT NOT NULL,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforces "only one group can be created per department" at the database
-- level, not just in application code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_groups_one_per_department
  ON feed_groups(department_id) WHERE type = 'department';

CREATE TABLE IF NOT EXISTS feed_group_members (
  group_id  UUID NOT NULL REFERENCES feed_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES feed_groups(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  urgent      BOOLEAN NOT NULL DEFAULT false,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id),
  author_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_acknowledgements (
  post_id  UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_group ON feed_posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id, created_at ASC);

-- One church-wide feed group per branch (branch_id NULL = the whole
-- church, for single-branch/consolidated setups). Safe to run repeatedly.
INSERT INTO feed_groups (type, name, branch_id)
SELECT 'church', 'Church Feed', NULL
WHERE NOT EXISTS (SELECT 1 FROM feed_groups WHERE type = 'church' AND branch_id IS NULL);
