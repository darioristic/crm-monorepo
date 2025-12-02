-- SQL script to manually update inline companies to have source = 'inline'
-- Replace 'COMPANY_NAME_1', 'COMPANY_NAME_2', etc. with actual inline company names

-- Example: Update specific companies by name
UPDATE companies 
SET source = 'inline' 
WHERE name IN ('Clssssud Native d.o.o.', 'PLATFORMA d.o.o.');

-- Or update all companies created after a specific date (if you know when inline form was added)
-- UPDATE companies 
-- SET source = 'inline' 
-- WHERE created_at > '2025-01-01'::timestamp;

-- Verify the changes
SELECT id, name, source, created_at 
FROM companies 
ORDER BY created_at DESC;

