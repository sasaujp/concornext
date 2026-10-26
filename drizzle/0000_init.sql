CREATE TABLE `ai_analyses` (
	`id` integer PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`passage_reference` text NOT NULL,
	`selected_lemma_id` integer,
	`selected_token_position` integer,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`source_version` text NOT NULL,
	`analysis_json` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_analyses_cache_key_idx` ON `ai_analyses` (`cache_key`);--> statement-breakpoint
CREATE TABLE `chapter_fetches` (
	`translation` text NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`translation`, `book`, `chapter`)
);
--> statement-breakpoint
CREATE TABLE `data_versions` (
	`source` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`detail` text,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lemma_definitions` (
	`lemma_id` integer PRIMARY KEY NOT NULL,
	`definition_html` text NOT NULL,
	FOREIGN KEY (`lemma_id`) REFERENCES `lemmas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lemmas` (
	`id` integer PRIMARY KEY NOT NULL,
	`strongs_id` text NOT NULL,
	`strongs_base` text NOT NULL,
	`greek_lemma` text NOT NULL,
	`lemma_plain` text NOT NULL,
	`alt_lemma` text,
	`alt_lemma_plain` text,
	`transliteration` text,
	`translit_plain` text,
	`gloss` text,
	`lex_pos` text,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`verse_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lemmas_strongs_id_idx` ON `lemmas` (`strongs_id`);--> statement-breakpoint
CREATE INDEX `lemmas_plain_idx` ON `lemmas` (`lemma_plain`);--> statement-breakpoint
CREATE INDEX `lemmas_alt_plain_idx` ON `lemmas` (`alt_lemma_plain`);--> statement-breakpoint
CREATE INDEX `lemmas_count_idx` ON `lemmas` (`occurrence_count`);--> statement-breakpoint
CREATE INDEX `lemmas_strongs_base_idx` ON `lemmas` (`strongs_base`);--> statement-breakpoint
CREATE INDEX `lemmas_translit_idx` ON `lemmas` (`translit_plain`);--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` integer PRIMARY KEY NOT NULL,
	`lemma_id` integer NOT NULL,
	`book_ord` integer NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`token_position` integer NOT NULL,
	`part` integer DEFAULT 0 NOT NULL,
	`surface_form` text NOT NULL,
	`surface_plain` text NOT NULL,
	`transliteration` text,
	`english_gloss` text,
	`morphology_code` text NOT NULL,
	`word_type` text NOT NULL,
	`edition_info` text NOT NULL,
	`instance` text,
	FOREIGN KEY (`lemma_id`) REFERENCES `lemmas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `occ_lemma_ref_idx` ON `occurrences` (`lemma_id`,`book_ord`,`chapter`,`verse`,`token_position`);--> statement-breakpoint
CREATE INDEX `occ_ref_idx` ON `occurrences` (`book_ord`,`chapter`,`verse`,`token_position`,`part`);--> statement-breakpoint
CREATE INDEX `occ_surface_plain_idx` ON `occurrences` (`surface_plain`);--> statement-breakpoint
CREATE TABLE `verse_cache` (
	`translation` text NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`text` text NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`translation`, `book`, `chapter`, `verse`)
);
