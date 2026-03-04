-- Seed data for initial 3 A/B experiments
-- Run after 0003_experiments.sql migration

INSERT INTO experiments (id, name, dimension, variants, status, traffic_pct, created_at, updated_at) VALUES
  ('exp-slider-anchor', 'Default Slider Anchor', 'default_slider_pos',
   '[{"id":"control","config":{"defaultSliderIdx":3},"weight":25},{"id":"anchor-0","config":{"defaultSliderIdx":0},"weight":25},{"id":"anchor-2","config":{"defaultSliderIdx":2},"weight":25},{"id":"anchor-4","config":{"defaultSliderIdx":4},"weight":25}]',
   'active', 100, strftime('%s','now') * 1000, strftime('%s','now') * 1000),

  ('exp-cta-text', 'CTA Button Text', 'cta_text',
   '[{"id":"control","config":{"ctaText":"Donate ${amount}"},"weight":25},{"id":"alive","config":{"ctaText":"Keep spike.land alive — ${amount}"},"weight":25},{"id":"join","config":{"ctaText":"Join {n} supporters — ${amount}"},"weight":25},{"id":"coffee","config":{"ctaText":"Buy Zoltan a coffee — ${amount}"},"weight":25}]',
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
