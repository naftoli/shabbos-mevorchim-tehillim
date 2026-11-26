-- Per-school ladder switches. Run once on the mashpia database.
-- Do not run this from the app, and do not alter Mashpia's schools table.
-- The API checks for this table and tells HQ to run this file when it is
-- missing. Every ladder, at every school, stays on until an admin saves an
-- off switch. No row means the ladder is on. A row with enabled = 0 hides
-- that ladder from the soldier's picker and from the virtual commander's
-- suggestions. The custom ladder is not a row here and stays available.

CREATE TABLE IF NOT EXISTS wwtc_school_ladders (
  school_id INT UNSIGNED NOT NULL,
  ladder TINYINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (school_id, ladder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
