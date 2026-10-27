-- Memos become per book (user, book, lemma). Existing memos (sample placeholders) are discarded
-- on purpose: start from a clean slate.
DROP TABLE `lemma_notes`;--> statement-breakpoint
CREATE TABLE `lemma_notes` (
	`user_id` text NOT NULL,
	`book` text NOT NULL,
	`strongs_id` text NOT NULL,
	`note` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `book`, `strongs_id`)
);
--> statement-breakpoint
CREATE INDEX `lemma_notes_user_strongs_idx` ON `lemma_notes` (`user_id`,`strongs_id`);
