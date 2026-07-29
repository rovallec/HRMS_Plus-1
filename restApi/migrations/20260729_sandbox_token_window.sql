ALTER TABLE `sandboxTokens`
  ADD COLUMN `tokenPurpose` VARCHAR(10) NOT NULL DEFAULT 'session' AFTER `feedback`,
  ADD COLUMN `expiresAt` DATETIME NULL AFTER `tokenPurpose`,
  ADD KEY `idx_sandbox_access_expiry` (`tokenPurpose`, `status`, `expiresAt`);

UPDATE `sandboxTokens`
SET `tokenPurpose` = CASE WHEN `status` = 1 THEN 'access' ELSE 'session' END;
