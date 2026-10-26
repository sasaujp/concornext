CREATE TABLE `auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`challenge` text NOT NULL,
	`user_id` text,
	`data` text,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`grants_admin` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`device_name` text,
	`created_at` text NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_lemma_notes` (
	`user_id` text NOT NULL,
	`strongs_id` text NOT NULL,
	`note` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `strongs_id`)
);
--> statement-breakpoint
-- Existing memos predate accounts: keep them unowned (user_id ''); the first administrator claims them.
INSERT INTO `__new_lemma_notes`("user_id", "strongs_id", "note", "updated_at") SELECT '', "strongs_id", "note", "updated_at" FROM `lemma_notes`;--> statement-breakpoint
DROP TABLE `lemma_notes`;--> statement-breakpoint
ALTER TABLE `__new_lemma_notes` RENAME TO `lemma_notes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;