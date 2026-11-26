-- Over-entry review queue for the Worldwide Tehillim Club.
-- Additive only: new tables, no changes to date_tasks_marks or mission marks.
-- Run once on the mashpia database. The API does not run this file.
-- Until it has been run, a report past the grade line is refused (it is not
-- saved as a normal counting mark).

CREATE TABLE IF NOT EXISTS wwtc_flagged_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  school_id INT UNSIGNED NOT NULL DEFAULT 0,
  class_id INT UNSIGNED NOT NULL DEFAULT 0,
  mark_date INT NOT NULL,
  campaign_year INT NOT NULL,
  month_name VARCHAR(32) NOT NULL,
  grade VARCHAR(16) NOT NULL,
  school_name VARCHAR(255) NOT NULL DEFAULT '',
  class_name VARCHAR(255) NOT NULL DEFAULT '',
  kid_name VARCHAR(255) NOT NULL DEFAULT '',
  kapitlach INT NOT NULL,
  minutes INT NOT NULL,
  quota_kapitlach INT NOT NULL DEFAULT 0,
  quota_minutes INT NOT NULL DEFAULT 0,
  threshold_kapitlach INT NOT NULL,
  threshold_minutes INT NOT NULL,
  reasons VARCHAR(32) NOT NULL,
  status ENUM('flagged','accepted','removed') NOT NULL DEFAULT 'flagged',
  prior_kapitlach INT NOT NULL DEFAULT 0,
  prior_minutes INT NOT NULL DEFAULT 0,
  prior_reported TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wwtc_flag_status (status, school_id),
  KEY idx_wwtc_flag_user_date (user_id, mark_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wwtc_flag_decisions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id INT UNSIGNED NOT NULL,
  action ENUM('flagged','accepted','removed') NOT NULL,
  actor_type VARCHAR(16) NOT NULL,
  actor_id INT UNSIGNED NOT NULL DEFAULT 0,
  actor_name VARCHAR(255) NOT NULL DEFAULT '',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wwtc_flag_decision_entry (entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
