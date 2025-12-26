-- Add availabilityStatus column to Device table
ALTER TABLE `Device` ADD `availabilityStatus` text DEFAULT 'selling' NOT NULL;

-- Create index for availabilityStatus
CREATE INDEX `Device_availabilityStatus_idx` ON `Device` (`availabilityStatus`);
