CREATE TABLE `ScrapeJob` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`userId` text NOT NULL,
	`step` text DEFAULT 'searching' NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`progressStage` text,
	`progressPercent` integer,
	`lastLog` text,
	`deviceName` text,
	`slug` text,
	`autocompleteOptions` text,
	`slugConflict` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`finishedAt` text
);
--> statement-breakpoint
CREATE INDEX `ScrapeJob_userId_updatedAt_idx` ON `ScrapeJob` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `ScrapeJob_step_updatedAt_idx` ON `ScrapeJob` (`step`,`updatedAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `ScrapeJob_deviceId_key` ON `ScrapeJob` (`deviceId`);