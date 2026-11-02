-- HQ dedications for the Worldwide Tehillim Campaign home page.
-- Run once on the mashpia database. The API checks for this table and
-- tells HQ to run this file when it is missing. school_id 0 is the army-wide line.

CREATE TABLE IF NOT EXISTS wwtc_dedications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope ENUM('army', 'school') NOT NULL,
  school_id INT UNSIGNED NOT NULL DEFAULT 0,
  campaign_year INT NOT NULL,
  month_name VARCHAR(32) NOT NULL,
  body TEXT NOT NULL,
  updated_by VARCHAR(64) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_wwtc_dedication (scope, school_id, campaign_year, month_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
