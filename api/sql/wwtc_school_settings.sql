-- Per-school start of the grade year. Run once on the mashpia database.
-- Do not run this from the app, and do not alter Mashpia's schools table.
-- The API checks for this table and tells HQ to run this file when it is
-- missing. No row for a school means the year starts in Tishrei, which is
-- today's sequence (Mevorchim Tishrei first, grade ends in Elul).
--
-- first_month is the school's first Shabbos Mevorchim (Mevorchim of that
-- month). Shvat means Mevorchim Shvat is quota position 1.

CREATE TABLE IF NOT EXISTS wwtc_school_settings (
  school_id INT UNSIGNED NOT NULL,
  first_month VARCHAR(32) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
