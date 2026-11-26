-- Class- and child-level ladder switches. Run once on the mashpia database.
-- Do not run this from the app. Do not alter wwtc_school_ladders or Mashpia's
-- schools, classes, or users tables.
--
-- wwtc_school_ladders stays the whole-school switch: no row means the ladder
-- is on, and a row with enabled = 0 turns it off for the school.
--
-- These two tables store only an explicit choice. No row means "inherit":
-- a class inherits the school, and a child inherits the class. enabled = 1
-- turns the ladder on at that scope. enabled = 0 turns it off. The closest
-- row wins (child, then class, then school). With no row anywhere, the
-- ladder stays on. A class can turn a school-off ladder back on, and a
-- child can turn a class-off ladder back on.
--
-- The API checks for both tables and tells HQ to run this file when a
-- school admin saves a class or child switch before they exist. Until then,
-- every class and child inherits the school, and the school switches keep
-- working.

CREATE TABLE IF NOT EXISTS wwtc_class_ladders (
  school_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  ladder TINYINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, ladder),
  KEY school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wwtc_child_ladders (
  school_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  ladder TINYINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, ladder),
  KEY school_class (school_id, class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
