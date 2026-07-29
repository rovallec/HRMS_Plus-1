CREATE TABLE IF NOT EXISTS `sandboxTokens` (
  `idsandboxTokens` INT NOT NULL AUTO_INCREMENT,
  `client` VARCHAR(45) NULL,
  `token` VARCHAR(200) NULL,
  `status` TINYINT NULL,
  `requested` VARCHAR(45) NULL,
  `feedback` TEXT NULL,
  `tokenPurpose` VARCHAR(10) NOT NULL DEFAULT 'session',
  `expiresAt` DATETIME NULL,
  PRIMARY KEY (`idsandboxTokens`),
  UNIQUE KEY `uq_sandbox_token` (`token`),
  KEY `idx_sandbox_requested_status` (`requested`, `status`),
  KEY `idx_sandbox_access_expiry` (`tokenPurpose`, `status`, `expiresAt`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
