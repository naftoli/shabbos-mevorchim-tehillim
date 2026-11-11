-- Monthly Shabbos Mevorchim follow-up log.
-- Run once on the mashpia database. The Wednesday job refuses to send
-- until both tables exist. Do not run this from the app.

-- One row per recipient per campaign month. A successful send is final:
-- running the job again updates nothing that was already outcome = 'sent'.
-- recipient_key is admin:{id}:base:{school_id} or admin:{id}:class:{class_id}.

CREATE TABLE IF NOT EXISTS wwtc_notify_sends (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_year INT NOT NULL,
  month_name VARCHAR(32) NOT NULL,
  recipient_key VARCHAR(80) NOT NULL,
  admin_id INT UNSIGNED NOT NULL,
  role ENUM('base', 'class') NOT NULL,
  school_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NULL,
  phone_e164 VARCHAR(20) NULL,
  email VARCHAR(255) NULL,
  channel VARCHAR(16) NULL,
  provider VARCHAR(32) NULL,
  outcome VARCHAR(32) NOT NULL,
  detail VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_wwtc_notify_month (recipient_key, campaign_year, month_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Opt-out flag. Insert the E.164 number (for example +17185550100) and the
-- job will not WhatsApp or text it. The SMS body tells the person to reply
-- STOP; Twilio's own opt-out is separate from this table, so record the
-- number here too when a STOP arrives.

CREATE TABLE IF NOT EXISTS wwtc_notify_opt_outs (
  phone_e164 VARCHAR(20) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (phone_e164)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
