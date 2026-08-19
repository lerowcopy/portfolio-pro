CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(120) NOT NULL,
	`bio` text NOT NULL,
	`logoUrl` varchar(1000),
	`avatarUrl` varchar(1000),
	`socialLinks` json NOT NULL,
	`template` enum('minimal','gallery','cards','blog') NOT NULL DEFAULT 'minimal',
	`colorScheme` enum('blue','dark','purple','green') NOT NULL DEFAULT 'blue',
	`fontFamily` enum('inter','playfair','georgia') NOT NULL DEFAULT 'inter',
	`isPublished` int NOT NULL DEFAULT 0,
	`publishedAt` timestamp,
	`slug` varchar(50) NOT NULL,
	`slugManuallyEdited` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolios_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `portfolios` ADD CONSTRAINT `portfolios_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `portfolios_owner_updated_idx` ON `portfolios` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `portfolios_public_slug_idx` ON `portfolios` (`isPublished`,`slug`);