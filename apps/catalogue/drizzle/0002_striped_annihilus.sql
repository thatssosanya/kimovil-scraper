ALTER TABLE `Device` ADD `normalizedName` text;--> statement-breakpoint
ALTER TABLE `Device` ADD `duplicateStatus` text DEFAULT 'unique' NOT NULL;--> statement-breakpoint
ALTER TABLE `Device` ADD `duplicateOfId` text;--> statement-breakpoint
CREATE INDEX `Device_normalizedName_idx` ON `Device` (`normalizedName`);--> statement-breakpoint
CREATE INDEX `Device_duplicateOfId_idx` ON `Device` (`duplicateOfId`);