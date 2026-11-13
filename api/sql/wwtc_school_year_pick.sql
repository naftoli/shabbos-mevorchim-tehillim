-- Let HQ decide whether a school admin may pick the grade-year start
-- month. Run once on the mashpia database, after wwtc_school_settings exists.
-- Do not run this from the app. Do not alter Mashpia's schools table.
--
-- wwtc_school_settings.first_month already stores the start month. Every
-- school with no row still starts in Tishrei, the first month of the
-- campaign year. A row that already has a month keeps that month.
--
-- allow_school_pick defaults to 0. Off means only HQ (admins.auth = super)
-- can change first_month. On means that school's admin may pick the month.
-- Until this file is applied, the column is absent and the API treats every
-- school as off: HQ can still save first_month, and a school admin cannot.

ALTER TABLE wwtc_school_settings
  ADD COLUMN allow_school_pick TINYINT(1) NOT NULL DEFAULT 0 AFTER first_month;
