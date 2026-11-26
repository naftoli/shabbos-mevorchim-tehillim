-- Perfect Platoon graphics ledger, plus the school WhatsApp number the office
-- uses to send those graphics.
--
-- Additive. Run this file ONCE on the mashpia database (the same database the
-- WWTC API already uses). Do not run it from the app, and do not run it from
-- a deploy script. Both statements are IF NOT EXISTS, so a second run is safe
-- but still unnecessary.
--
-- Until this file has been run, the daily job exits with a message naming this
-- path, and the office page says storage is not installed. The public page
-- just shows that no graphics have been posted.
--
-- School WhatsApp numbers live in wwtc_school_contacts, not on `schools` and
-- not on wwtc_platoon_graphics. The public graphics queries never read that
-- table. Student names are not stored here at all.

CREATE TABLE IF NOT EXISTS wwtc_platoon_graphics (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  school_id INT UNSIGNED NOT NULL,
  school_name VARCHAR(255) NOT NULL,
  class_id INT UNSIGNED NOT NULL DEFAULT 0,
  class_name VARCHAR(64) NOT NULL,
  grade VARCHAR(16) NOT NULL,
  grade_label VARCHAR(64) NOT NULL,
  campaign_year INT NOT NULL,
  month_name VARCHAR(32) NOT NULL,
  file_path VARCHAR(512) NOT NULL DEFAULT '',
  made_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  sent_by VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_wwtc_platoon_graphic (school_id, class_name, grade, campaign_year, month_name),
  KEY idx_wwtc_platoon_graphics_month (campaign_year, month_name),
  KEY idx_wwtc_platoon_graphics_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wwtc_school_contacts (
  school_id INT UNSIGNED NOT NULL,
  whatsapp VARCHAR(20) NULL,
  updated_by VARCHAR(64) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
