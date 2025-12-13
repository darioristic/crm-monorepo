-- Firecrawl Integration Tables

CREATE TABLE IF NOT EXISTS firecrawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_id VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL, -- scrape, crawl, map, search, extract, batch_scrape
  status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_firecrawl_jobs_tenant ON firecrawl_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_firecrawl_jobs_type ON firecrawl_jobs(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_firecrawl_jobs_status ON firecrawl_jobs(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_firecrawl_jobs_request ON firecrawl_jobs(request_id);

CREATE TABLE IF NOT EXISTS firecrawl_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES firecrawl_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firecrawl_results_tenant ON firecrawl_results(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_firecrawl_results_job ON firecrawl_results(job_id);
