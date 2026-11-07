-- School.schemaName was built as "school_<subdomain>", and a subdomain may hold hyphens, which the schema-name
-- check rejects ("school_core-test-ab12"), so provisioning failed for those schools.
-- Schools whose schema is NOT built yet get the valid name now: hyphens (and anything else outside a-z, 0-9) become "_".
-- Subdomains never contain "_", so two schools cannot end up with the same name.
-- Schools whose schema IS built are left alone: renaming a live schema is done by `npm run repair:schema-names`.
UPDATE "School"
SET    "schemaName" = 'school_' || trim(both '_' from regexp_replace(lower("subdomain"), '[^a-z0-9]+', '_', 'g'))
WHERE  "schemaProvisionedAt" IS NULL
  AND  ("schemaName" IS NULL OR "schemaName" !~ '^[a-z][a-z0-9_]*$');
