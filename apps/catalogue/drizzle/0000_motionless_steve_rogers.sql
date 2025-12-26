CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Account_provider_providerAccountId_key` ON `Account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE INDEX `Account_userId_idx` ON `Account` (`userId`);--> statement-breakpoint
CREATE TABLE `AliExpressItem` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`name` text,
	`commissionRate` text,
	`imageUrl` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AliExpressItem_url_unique` ON `AliExpressItem` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `AliExpressItem_url_key` ON `AliExpressItem` (`url`);--> statement-breakpoint
CREATE TABLE `Benchmark` (
	`id` text PRIMARY KEY NOT NULL,
	`characteristicsId` text NOT NULL,
	`name` text NOT NULL,
	`score` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Benchmark_characteristicsId_idx` ON `Benchmark` (`characteristicsId`);--> statement-breakpoint
CREATE TABLE `Camera` (
	`id` text PRIMARY KEY NOT NULL,
	`characteristicsId` text NOT NULL,
	`resolution_mp` real NOT NULL,
	`aperture_fstop` text NOT NULL,
	`sensor` text,
	`type` text,
	`features` text
);
--> statement-breakpoint
CREATE INDEX `Camera_characteristicsId_idx` ON `Camera` (`characteristicsId`);--> statement-breakpoint
CREATE TABLE `Category` (
	`id` text PRIMARY KEY NOT NULL,
	`wordpressId` text NOT NULL,
	`name` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `_CategoryToWidget` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `_CategoryToWidget_AB_unique` ON `_CategoryToWidget` (`A`,`B`);--> statement-breakpoint
CREATE INDEX `_CategoryToWidget_B_index` ON `_CategoryToWidget` (`B`);--> statement-breakpoint
CREATE TABLE `Config` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` text,
	`ram` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Config_name_unique` ON `Config` (`name`);--> statement-breakpoint
CREATE TABLE `_ConfigToDevice` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `_ConfigToDevice_AB_unique` ON `_ConfigToDevice` (`A`,`B`);--> statement-breakpoint
CREATE INDEX `_ConfigToDevice_B_index` ON `_ConfigToDevice` (`B`);--> statement-breakpoint
CREATE TABLE `Device` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`type` text,
	`imageUrl` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`yandexId` text,
	`widgetId` text,
	`description` text,
	`valueRating` integer
);
--> statement-breakpoint
CREATE INDEX `Device_widgetId_idx` ON `Device` (`widgetId`);--> statement-breakpoint
CREATE TABLE `DeviceCharacteristics` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deviceId` text NOT NULL,
	`raw` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`aliases` text NOT NULL,
	`releaseDate` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`publishedAt` integer,
	`height_mm` real,
	`width_mm` real,
	`thickness_mm` real,
	`weight_g` real,
	`materials` text NOT NULL,
	`ipRating` text,
	`colors` text NOT NULL,
	`cpu` text,
	`cpuManufacturer` text,
	`cpuCores` text,
	`gpu` text,
	`sdSlot` integer,
	`fingerprintPosition` text,
	`nfc` integer,
	`bluetooth` text,
	`sim` text NOT NULL,
	`simCount` integer NOT NULL,
	`usb` text,
	`headphoneJack` integer,
	`batteryCapacity_mah` real,
	`batteryFastCharging` integer,
	`batteryWattage` real,
	`cameraFeatures` text NOT NULL,
	`os` text,
	`osSkin` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DeviceCharacteristics_slug_unique` ON `DeviceCharacteristics` (`slug`);--> statement-breakpoint
CREATE INDEX `DeviceCharacteristics_deviceId_idx` ON `DeviceCharacteristics` (`deviceId`);--> statement-breakpoint
CREATE INDEX `DeviceCharacteristics_status_idx` ON `DeviceCharacteristics` (`status`);--> statement-breakpoint
CREATE INDEX `DeviceCharacteristics_slug_status_idx` ON `DeviceCharacteristics` (`slug`,`status`);--> statement-breakpoint
CREATE TABLE `_DeviceToRating` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `_DeviceToRating_AB_unique` ON `_DeviceToRating` (`A`,`B`);--> statement-breakpoint
CREATE INDEX `_DeviceToRating_B_index` ON `_DeviceToRating` (`B`);--> statement-breakpoint
CREATE TABLE `Example` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Link` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`url` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`price` integer NOT NULL,
	`deviceId` text,
	`marketplaceId` text,
	`configId` text,
	`skuId` text
);
--> statement-breakpoint
CREATE INDEX `Link_deviceId_idx` ON `Link` (`deviceId`);--> statement-breakpoint
CREATE INDEX `Link_marketplaceId_idx` ON `Link` (`marketplaceId`);--> statement-breakpoint
CREATE INDEX `Link_configId_idx` ON `Link` (`configId`);--> statement-breakpoint
CREATE INDEX `Link_skuId_idx` ON `Link` (`skuId`);--> statement-breakpoint
CREATE TABLE `Marketplace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`iconUrl` text,
	`baseUrl` text
);
--> statement-breakpoint
CREATE TABLE `ProsCons` (
	`id` text PRIMARY KEY NOT NULL,
	`deviceId` text NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`source` text,
	`category` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ProsCons_deviceId_idx` ON `ProsCons` (`deviceId`);--> statement-breakpoint
CREATE INDEX `ProsCons_type_idx` ON `ProsCons` (`type`);--> statement-breakpoint
CREATE TABLE `Rating` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`ratingTypeId` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`publishedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Rating_slug_unique` ON `Rating` (`slug`);--> statement-breakpoint
CREATE INDEX `Rating_ratingTypeId_idx` ON `Rating` (`ratingTypeId`);--> statement-breakpoint
CREATE INDEX `Rating_ratingTypeId_createdAt_idx` ON `Rating` (`ratingTypeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `Rating_status_idx` ON `Rating` (`status`);--> statement-breakpoint
CREATE INDEX `Rating_slug_idx` ON `Rating` (`slug`);--> statement-breakpoint
CREATE INDEX `Rating_slug_status_idx` ON `Rating` (`slug`,`status`);--> statement-breakpoint
CREATE TABLE `RatingCategory` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RatingCategory_slug_unique` ON `RatingCategory` (`slug`);--> statement-breakpoint
CREATE TABLE `RatingPosition` (
	`id` text PRIMARY KEY NOT NULL,
	`customDescription` text,
	`deviceId` text NOT NULL,
	`ratingId` text NOT NULL,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RatingPosition_ratingId_deviceId_key` ON `RatingPosition` (`ratingId`,`deviceId`);--> statement-breakpoint
CREATE UNIQUE INDEX `RatingPosition_ratingId_position_key` ON `RatingPosition` (`ratingId`,`position`);--> statement-breakpoint
CREATE INDEX `RatingPosition_deviceId_idx` ON `RatingPosition` (`deviceId`);--> statement-breakpoint
CREATE INDEX `RatingPosition_ratingId_idx` ON `RatingPosition` (`ratingId`);--> statement-breakpoint
CREATE INDEX `RatingPosition_position_ratingId_idx` ON `RatingPosition` (`position`,`ratingId`);--> statement-breakpoint
CREATE TABLE `_RatingToRatingCategory` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `_RatingToRatingCategory_AB_unique` ON `_RatingToRatingCategory` (`A`,`B`);--> statement-breakpoint
CREATE INDEX `_RatingToRatingCategory_B_index` ON `_RatingToRatingCategory` (`B`);--> statement-breakpoint
CREATE TABLE `RatingType` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`displayName` text,
	`description` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RatingType_name_unique` ON `RatingType` (`name`);--> statement-breakpoint
CREATE TABLE `RatingsGroup` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`displayName` text,
	`description` text,
	`displayType` text DEFAULT 'regular' NOT NULL,
	`type` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `RatingsGroupPosition` (
	`id` text PRIMARY KEY NOT NULL,
	`ratingId` text NOT NULL,
	`groupId` text NOT NULL,
	`position` integer NOT NULL,
	`shortName` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RatingsGroupPosition_groupId_ratingId_key` ON `RatingsGroupPosition` (`groupId`,`ratingId`);--> statement-breakpoint
CREATE UNIQUE INDEX `RatingsGroupPosition_groupId_position_key` ON `RatingsGroupPosition` (`groupId`,`position`);--> statement-breakpoint
CREATE INDEX `RatingsGroupPosition_ratingId_idx` ON `RatingsGroupPosition` (`ratingId`);--> statement-breakpoint
CREATE INDEX `RatingsGroupPosition_groupId_idx` ON `RatingsGroupPosition` (`groupId`);--> statement-breakpoint
CREATE INDEX `RatingsGroupPosition_position_groupId_idx` ON `RatingsGroupPosition` (`position`,`groupId`);--> statement-breakpoint
CREATE TABLE `RatingsPage` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`iconName` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`publishedAt` integer,
	`position` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RatingsPage_slug_unique` ON `RatingsPage` (`slug`);--> statement-breakpoint
CREATE INDEX `RatingsPage_status_idx` ON `RatingsPage` (`status`);--> statement-breakpoint
CREATE INDEX `RatingsPage_position_idx` ON `RatingsPage` (`position`);--> statement-breakpoint
CREATE INDEX `RatingsPage_slug_idx` ON `RatingsPage` (`slug`);--> statement-breakpoint
CREATE TABLE `RatingsPagePosition` (
	`id` text PRIMARY KEY NOT NULL,
	`groupId` text NOT NULL,
	`pageId` text NOT NULL,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RatingsPagePosition_pageId_groupId_key` ON `RatingsPagePosition` (`pageId`,`groupId`);--> statement-breakpoint
CREATE UNIQUE INDEX `RatingsPagePosition_pageId_position_key` ON `RatingsPagePosition` (`pageId`,`position`);--> statement-breakpoint
CREATE INDEX `RatingsPagePosition_groupId_idx` ON `RatingsPagePosition` (`groupId`);--> statement-breakpoint
CREATE INDEX `RatingsPagePosition_pageId_idx` ON `RatingsPagePosition` (`pageId`);--> statement-breakpoint
CREATE INDEX `RatingsPagePosition_position_pageId_idx` ON `RatingsPagePosition` (`position`,`pageId`);--> statement-breakpoint
CREATE TABLE `Screen` (
	`id` text PRIMARY KEY NOT NULL,
	`characteristicsId` text NOT NULL,
	`position` text NOT NULL,
	`size_in` real,
	`displayType` text,
	`resolution` text,
	`aspectRatio` text,
	`ppi` integer,
	`displayFeatures` text,
	`refreshRate` integer,
	`brightnessNits` integer,
	`isMain` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Screen_characteristicsId_position_key` ON `Screen` (`characteristicsId`,`position`);--> statement-breakpoint
CREATE INDEX `Screen_characteristicsId_idx` ON `Screen` (`characteristicsId`);--> statement-breakpoint
CREATE TABLE `Session` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionToken` text NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_sessionToken_unique` ON `Session` (`sessionToken`);--> statement-breakpoint
CREATE INDEX `Session_userId_idx` ON `Session` (`userId`);--> statement-breakpoint
CREATE TABLE `Sku` (
	`id` text PRIMARY KEY NOT NULL,
	`characteristicsId` text NOT NULL,
	`marketId` text NOT NULL,
	`ram_gb` integer NOT NULL,
	`storage_gb` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Sku_characteristicsId_idx` ON `Sku` (`characteristicsId`);--> statement-breakpoint
CREATE INDEX `Sku_id_idx` ON `Sku` (`id`);--> statement-breakpoint
CREATE TABLE `Tag` (
	`id` text PRIMARY KEY NOT NULL,
	`wordpressId` text NOT NULL,
	`name` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `_TagToWidget` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `_TagToWidget_AB_unique` ON `_TagToWidget` (`A`,`B`);--> statement-breakpoint
CREATE INDEX `_TagToWidget_B_index` ON `_TagToWidget` (`B`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_token_unique` ON `VerificationToken` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `VerificationToken_identifier_token_key` ON `VerificationToken` (`identifier`,`token`);--> statement-breakpoint
CREATE TABLE `Widget` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`widgetTypeId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Widget_widgetTypeId_idx` ON `Widget` (`widgetTypeId`);--> statement-breakpoint
CREATE TABLE `WidgetType` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`type` text
);
