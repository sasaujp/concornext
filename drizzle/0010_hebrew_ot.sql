-- Hebrew Old Testament (TAHOT): lemmas get a language, the Greek-specific column name goes,
-- occurrences gain the English verse numbering and the Hebrew word segments / Ketiv.
ALTER TABLE `lemmas` RENAME COLUMN `greek_lemma` TO `lemma`;--> statement-breakpoint
ALTER TABLE `lemmas` ADD `language` text DEFAULT 'grc' NOT NULL;--> statement-breakpoint
ALTER TABLE `occurrences` ADD `eng_chapter` integer;--> statement-breakpoint
ALTER TABLE `occurrences` ADD `eng_verse` integer;--> statement-breakpoint
ALTER TABLE `occurrences` ADD `segments` text;--> statement-breakpoint
ALTER TABLE `occurrences` ADD `ketiv` text;--> statement-breakpoint
ALTER TABLE `occurrences` ADD `ketiv_gloss` text;--> statement-breakpoint
-- Books are now numbered 1 = Genesis … 39 = Malachi, 40 = Matthew … 66 = Revelation.
-- Shift the NT rows already loaded so the database stays usable until the next data import.
UPDATE `occurrences` SET `book_ord` = `book_ord` + 39 WHERE `book_ord` <= 27;
