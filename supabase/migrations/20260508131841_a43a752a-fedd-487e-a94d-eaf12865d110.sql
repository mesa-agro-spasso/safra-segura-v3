ALTER TABLE staging.orders DISABLE TRIGGER USER;
UPDATE staging.orders SET ticker = 'ZSQ26' WHERE ticker IN ('ZSN25', 'ZSQ25');
UPDATE staging.orders SET ticker = 'CCMU26' WHERE ticker = 'CCMN25';
ALTER TABLE staging.orders ENABLE TRIGGER USER;
UPDATE staging.pricing_snapshots SET ticker = 'ZSQ26' WHERE ticker IN ('ZSN25', 'ZSQ25');
UPDATE staging.pricing_snapshots SET ticker = 'CCMU26' WHERE ticker = 'CCMN25';