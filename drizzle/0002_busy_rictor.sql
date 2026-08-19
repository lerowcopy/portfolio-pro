ALTER TABLE `portfolios` MODIFY COLUMN `template` enum('minimal','gallery','cards','blog','creative','agency','showcase') NOT NULL DEFAULT 'minimal';--> statement-breakpoint
ALTER TABLE `portfolios` MODIFY COLUMN `colorScheme` enum('blue','dark','purple','green','warm') NOT NULL DEFAULT 'blue';--> statement-breakpoint
ALTER TABLE `portfolios` ADD `projects` json;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `services` json;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `posts` json;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `contactEmail` varchar(320);