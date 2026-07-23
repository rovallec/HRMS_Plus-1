IF COL_LENGTH('tracking', 'lookup_attempts') IS NULL
    ALTER TABLE tracking ADD lookup_attempts INT NOT NULL CONSTRAINT DF_tracking_lookup_attempts DEFAULT 0;

IF COL_LENGTH('tracking', 'access_session_hash') IS NULL
    ALTER TABLE tracking ADD access_session_hash VARCHAR(64) NULL;

IF COL_LENGTH('tracking', 'order_number_changed') IS NULL
    ALTER TABLE tracking ADD order_number_changed BIT NOT NULL CONSTRAINT DF_tracking_order_number_changed DEFAULT 0;
