CREATE TABLE `portfolio_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`title` varchar(100) NOT NULL,
	`description` varchar(1000) NOT NULL,
	`images` json NOT NULL,
	`projectUrl` varchar(500),
	`tags` json NOT NULL,
	`startDate` date,
	`endDate` date,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `portfolio_projects` ADD CONSTRAINT `portfolio_projects_portfolioId_portfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `portfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `portfolio_projects_portfolio_order_idx` ON `portfolio_projects` (`portfolioId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `portfolio_projects_portfolio_created_idx` ON `portfolio_projects` (`portfolioId`,`createdAt`);