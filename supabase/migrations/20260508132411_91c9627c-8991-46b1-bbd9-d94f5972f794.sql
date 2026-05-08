ALTER TABLE staging.orders DISABLE TRIGGER USER;
UPDATE staging.orders
SET price = price / 100
WHERE instrument_type = 'futures'
  AND currency = 'USD'
  AND price > 100;
ALTER TABLE staging.orders ENABLE TRIGGER USER;