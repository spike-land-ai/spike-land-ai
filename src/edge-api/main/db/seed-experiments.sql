-- Seed data for initial 3 A/B experiments
-- Run after 0003_experiments.sql migration

INSERT INTO experiments (id, name, dimension, variants, status, traffic_pct, created_at, updated_at) VALUES
  ('exp-slider-anchor', 'Default Slider Anchor', 'default_slider_pos',
   '[{"id":"control","config":{"defaultSliderIdx":3},"weight":25},{"id":"anchor-0","config":{"defaultSliderIdx":0},"weight":25},{"id":"anchor-2","config":{"defaultSliderIdx":2},"weight":25},{"id":"anchor-4","config":{"defaultSliderIdx":4},"weight":25}]',
   'active', 100, strftime('%s','now') * 1000, strftime('%s','now') * 1000),

  ('exp-cta-text', 'CTA Button Text', 'cta_text',
   '[{"id":"control","config":{"ctaText":"Donate ${amount}"},"weight":25},{"id":"alive","config":{"ctaText":"Keep spike.land alive — ${amount}"},"weight":25},{"id":"join","config":{"ctaText":"Join {n} supporters — ${amount}"},"weight":25},{"id":"coffee","config":{"ctaText":"Buy Radix a coffee — ${amount}"},"weight":25}]',
   'active', 100, strftime('%s','now') * 1000, strftime('%s','now') * 1000),

  ('exp-social-proof', 'Social Proof Display', 'social_proof',
   '[{"id":"control","config":{"showSocialProof":true,"socialProofStyle":"exact"},"weight":25},{"id":"hidden","config":{"showSocialProof":false,"socialProofStyle":"hidden"},"weight":25},{"id":"fuzzy","config":{"showSocialProof":true,"socialProofStyle":"fuzzy"},"weight":25},{"id":"recent","config":{"showSocialProof":true,"socialProofStyle":"recent"},"weight":25}]',
   'active', 100, strftime('%s','now') * 1000, strftime('%s','now') * 1000);

-- Initialize metrics rows for each experiment/variant/metric combination
INSERT INTO experiment_metrics (id, experiment_id, variant_id, metric_name, metric_value, sample_size, updated_at)
SELECT
  lower(hex(randomblob(16))),
  e.id,
  json_extract(v.value, '$.id'),
  m.name,
  0,
  0,
  strftime('%s','now') * 1000
FROM experiments e,
     json_each(e.variants) v,
     (SELECT 'impressions' as name UNION ALL SELECT 'donations' UNION ALL SELECT 'revenue_cents' UNION ALL SELECT 'fistbumps') m
WHERE e.id IN ('exp-slider-anchor', 'exp-cta-text', 'exp-social-proof');

-- Seed: blog-code-belong-story-v1 experiment
-- Two variants: adhd-rent (personal story) vs neutral (professional)

INSERT OR IGNORE INTO experiments (id, name, dimension, variants, status, traffic_pct, created_at, updated_at)
VALUES (
  'blog-code-belong-story-v1',
  'Blog Code Belong Story',
  'blog_intro_style',
  '[{"id":"adhd-rent","config":{"style":"personal","label":"ADHD Rent Story"},"weight":50},{"id":"neutral","config":{"style":"professional","label":"Neutral Professional"},"weight":50}]',
  'active',
  100,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
);

INSERT OR IGNORE INTO experiment_metrics (id, experiment_id, variant_id, metric_name, metric_value, sample_size, updated_at)
SELECT
  lower(hex(randomblob(16))),
  'blog-code-belong-story-v1',
  json_extract(v.value, '$.id'),
  m.name,
  0,
  0,
  strftime('%s','now') * 1000
FROM json_each((SELECT variants FROM experiments WHERE id = 'blog-code-belong-story-v1')) v,
     (SELECT 'story_impression' as name
      UNION ALL SELECT 'quiz_started'
      UNION ALL SELECT 'categorizer_used'
      UNION ALL SELECT 'support_clicked') m;
