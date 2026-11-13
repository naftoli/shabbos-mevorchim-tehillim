-- Base-commander quota overrides for one soldier and one campaign month.
-- Run once on the mashpia database. Do not run this from the app.
-- The API checks for these tables and tells HQ to run this file when they
-- are missing. Undone rows stay in the table (undone_at is set); a later
-- override for the same soldier and month inserts a new row.
--
-- wwtc_quota_overrides is the override itself.
-- wwtc_audit_log records who did it and when (override and undo).

CREATE TABLE IF NOT EXISTS wwtc_quota_overrides (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  campaign_year INT NOT NULL,
  month_name VARCHAR(32) NOT NULL,
  original_quota INT NOT NULL,
  overridden_quota INT NOT NULL,
  created_by INT UNSIGNED NULL,
  created_by_name VARCHAR(191) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(500) NULL,
  undone_at TIMESTAMP NULL DEFAULT NULL,
  undone_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_wwtc_override_kid_month (user_id, campaign_year, month_name, undone_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wwtc_audit_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  action VARCHAR(64) NOT NULL,
  actor_id INT UNSIGNED NULL,
  actor_name VARCHAR(191) NULL,
  user_id INT UNSIGNED NULL,
  campaign_year INT NULL,
  month_name VARCHAR(32) NULL,
  detail VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wwtc_audit_created (created_at),
  KEY idx_wwtc_audit_user (user_id, campaign_year, month_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
