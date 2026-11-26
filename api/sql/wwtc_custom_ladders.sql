-- One custom ladder per soldier: the kapitlach target, the finish grade,
-- and the generated grade × month grid. Run once on the mashpia database.
-- Do not run this from the app. The API checks for this table and tells HQ
-- to run this file when it is missing.
--
-- Removed rows stay in the table (removed_at is set). A later ladder for the
-- same soldier inserts a new row. The grid is stored so reports stay stable
-- even if the generator changes later.
--
-- Set and remove are also written to wwtc_audit_log (action
-- custom_ladder_set / custom_ladder_remove). That table is created by
-- api/sql/wwtc_quota_overrides.sql. Run that file too if it is not there yet.
-- This file does not alter any Mashpia table.

CREATE TABLE IF NOT EXISTS wwtc_custom_ladders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  target_kapitlach INT NOT NULL,
  finish_grade VARCHAR(16) NOT NULL,
  based_on_ladder INT NULL,
  ladder_json LONGTEXT NOT NULL,
  anchor_grade VARCHAR(16) NULL,
  anchor_month VARCHAR(32) NULL,
  anchor_kapitlach DECIMAL(6,1) NULL,
  anchor_minutes INT NULL,
  reason VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL DEFAULT NULL,
  removed_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_wwtc_custom_ladder_user (user_id, removed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
