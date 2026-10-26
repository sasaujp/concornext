ALTER TABLE `occurrences` ADD `translit_plain` text;--> statement-breakpoint
CREATE INDEX `occ_translit_plain_idx` ON `occurrences` (`translit_plain`);