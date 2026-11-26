-- Top 10 school graphics, one row per school per Shabbos Mevorchim month.
--
-- Additive. Run this file ONCE on the mashpia database (the same database the
-- WWTC API already uses). Do not run it from the app, and do not run it from
-- a deploy script. The statement is IF NOT EXISTS, so a second run is safe
-- but still unnecessary.
--
-- Until this file has been run, the daily job still makes Perfect Platoon
-- graphics and prints a note naming this file. The office and the school
-- share page say Top 10 storage is not installed. They keep showing Perfect
-- Platoon graphics.
--
-- Student names are not stored here. Rank is the Top Base place from The Race
-- (percent of soldiers who met, then how many met). A tie shares one number.

CREATE TABLE IF NOT EXISTS wwtc_top_school_graphics (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  school_id INT UNSIGNED NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  campaign_year INT NOT NULL,
  month_name VARCHAR(32) NOT NULL,
  rank_place SMALLINT UNSIGNED NOT NULL,
  file_path VARCHAR(512) NOT NULL DEFAULT '',
  made_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  sent_by VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_wwtc_top_school_graphic (school_id, campaign_year, month_name),
  KEY idx_wwtc_top_school_graphics_month (campaign_year, month_name),
  KEY idx_wwtc_top_school_graphics_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
