Area	Issue	Fix
seed.ts	Mixing public/platform data with tenant data will become messy	Keep seed.ts only for public schema (plans, super admin, global configs).
Tenant seed	Tenant defaults are inside the worker	Move tenant seeding into TenantProvisioningService.
baseline.sql	SQL creates tables but no version control	Use migrations or a versioned baseline system for tenant schema changes.
Tenant schema creation	CREATE SCHEMA + raw SQL everywhere makes maintenance harder	Create a dedicated tenant provisioning service layer.
Worker	Worker is doing database logic, business logic, and seeding together	Worker should only trigger TenantProvisioningService.provision().
Prisma schema	One merged schema generates one Prisma client for public + tenant	Consider separate Prisma clients for public DB and tenant DB operations.
Generated Prisma	Generated client is committed/generated manually	Add generation step to deployment pipeline.
Raw SQL inserts	Many values are directly interpolated into SQL strings	Use parameterized queries to avoid SQL injection and escaping issues.
Schema name	school_${subdomain} can contain unsafe characters	Sanitize subdomain before creating schema names.
Tenant migrations	No clear strategy when models change later	Create tenant migration runner/version table.
Baseline SQL	New tables added later won't reach existing schools	Build tenant migration system, not only baseline.sql.
Seed duplicates	Some seeds have no idempotency protection	Use upsert or ON CONFLICT everywhere.
Default classes	Class seeding depends on category only	Allow schools to customize/remove default classes later.
Default subjects	Subjects are hardcoded	Move defaults into configuration files/database tables.
Grading config	Grading scale is hardcoded Nigerian WAEC style	Make grading templates configurable per school.
Session creation	Current year dates are fixed	Allow school calendar configuration.
School provisioning	No rollback if step fails halfway	Wrap provisioning steps with transactions/status tracking.
Provision status	School does not track provisioning progress	Add fields like provisioningStatus, provisionedAt, failureReason.
Queue worker	Failed provisioning leaves partial schema	Add cleanup/retry strategy.
Notifications	Tenant/public notifications share similar concepts	Keep platform notifications and school notifications completely separated.
Audit logs	Tenant actions only reference public IDs	Add better tenant context tracking.
Foreign keys	Tenant schema cannot reference public schema	Keep cross-schema relations handled in application layer.
Payments	Payment provider fields are scattered	Create payment transaction abstraction/service.
Files	Upload URLs stored without metadata	Add file model (size, mime type, owner, storage provider).
Authentication	Students/guardians/staff share user patterns but not fully unified	Consider identity mapping strategy.
Roles	Role enum is global and growing	Add permission table instead of only hardcoded roles.
Subscription	Billing logic tied directly to Paystack fields	Create payment provider abstraction.
Secrets	Super admin seed password is hardcoded	Load from environment variables.
Database	No indexes on many tenant lookup fields	Add indexes for email, admission number, dates, foreign keys.
Unique constraints	Some tenant models may conflict after customization	Review unique fields (subject code, admission number, etc.).
Logging	Worker logs only console	Add structured logging (request/job IDs).
Testing	No provisioning tests	Add integration tests for creating a school end-to-end.





9470m:~/yt-projects/multi-school-portal$ npm run prisma:migrate:tenant -- --name tenant_baseline --create-only

> multi-school-portal@1.0.0 prisma:migrate:tenant
> prisma migrate dev --schema=prisma/tenant.prisma --name tenant_baseline --create-only

◇ injected env (24) from .env.development // tip: ⌘ override existing { override: true }
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/tenant.prisma.
Datasource "db": PostgreSQL database "school_portal", schema "public" at "localhost:5432"


Error: Prisma schema validation - (validate wasm)
Error code: P1012
error: Type "NotificationChannel" is neither a built-in type, nor refers to another model, composite type, or enum.
  -->  prisma/tenant.prisma:409
   | 
408 |     staffId        String?
409 |     channel        NotificationChannel
   | 
error: Type "DeliveryStatus" is neither a built-in type, nor refers to another model, composite type, or enum.
  -->  prisma/tenant.prisma:410
   | 
409 |     channel        NotificationChannel
410 |     status         DeliveryStatus       @default(PENDING)
   | 
error: Error validating model "SchoolNotificationRecipient": The index definition refers to the relation fields status. Index definitions must reference only scalar fields.
  -->  prisma/tenant.prisma:427
   | 
426 |     @@unique([notificationId, channel, studentId, guardianId, staffId])
427 |     @@index([status])
   | 
error: Error validating model "SchoolNotificationRecipient": The index definition refers to the relation fields status. Index definitions must reference only scalar fields.
  -->  prisma/tenant.prisma:428
   | 
427 |     @@index([status])
428 |     @@index([status, priority, createdAt])
   | 
error: Error validating model "SchoolNotificationRecipient": The unique index definition refers to the relation fields channel. Index definitions must reference only scalar fields.
  -->  prisma/tenant.prisma:426
   | 
425 | 
426 |     @@unique([notificationId, channel, studentId, guardianId, staffId])
   | 

Validation Error Count: 5
[Context: validate]

Prisma CLI Version : 7.9.0