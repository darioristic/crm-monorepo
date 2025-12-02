-- SQL script to check for deleted companies and potentially restore them
-- WARNING: This only works if you have a database backup or transaction log

-- 1. Check if PostgreSQL has point-in-time recovery enabled
-- If yes, you can restore to a point before deletion

-- 2. Check for any backup files
-- Look for .sql dump files or pg_dump backups

-- 3. If you have a backup, restore companies from backup:
-- 
-- Example restore from backup (replace with actual backup file):
-- psql -U crm_user -d crm_db < backup_file.sql
--
-- Or restore specific companies:
-- INSERT INTO companies (id, name, industry, address, email, logo_url, created_at, updated_at, source)
-- SELECT id, name, industry, address, email, logo_url, created_at, updated_at, source
-- FROM backup_table
-- WHERE id IN ('company-id-1', 'company-id-2');

-- 4. Check PostgreSQL WAL (Write-Ahead Log) if point-in-time recovery is enabled
-- This requires PostgreSQL configuration with archive_mode = on

-- 5. If you have transaction logs, you might be able to replay them up to a point before deletion

-- For now, check what companies still exist:
SELECT id, name, source, created_at 
FROM companies 
ORDER BY created_at DESC;

-- Check if there are any orphaned records (invoices, quotes, etc. without companies):
SELECT 
  'invoices' as table_name,
  COUNT(*) as orphaned_count
FROM invoices i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL
UNION ALL
SELECT 
  'quotes' as table_name,
  COUNT(*) as orphaned_count
FROM quotes q
LEFT JOIN companies c ON q.company_id = c.id
WHERE c.id IS NULL
UNION ALL
SELECT 
  'delivery_notes' as table_name,
  COUNT(*) as orphaned_count
FROM delivery_notes dn
LEFT JOIN companies c ON dn.company_id = c.id
WHERE c.id IS NULL;

