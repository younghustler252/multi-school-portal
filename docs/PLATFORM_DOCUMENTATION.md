# Platform Documentation (Legacy Entry Point)

This file is retained as a backward-compatible entry point. Its architecture content has been split into focused guides so each topic has a clear owner and can be maintained independently.

## Current architecture guides

- [System and Monorepo Architecture](architecture/system-and-monorepo.md)
- [Multi-Tenancy and Database Architecture](architecture/multi-tenancy-and-database.md)
- [Authentication and Authorization](architecture/authentication-and-authorization.md)
- [Background Processing](architecture/background-processing.md)
- [Finance Architecture and Invariants](architecture/finance-architecture.md)

The guides above preserve the source-checked architecture snapshot from `refactor/modules` at commit `23a5e0a5538f747de27ddff29b24a913791eaac2` (2026-11-05).

**Source code, Prisma schemas/migrations, tests and runtime configuration remain authoritative.** The guides are architecture documentation, not complete API contracts or proof of deployment/runtime behavior.

For endpoint methods, request/response DTOs, permissions and response shapes, inspect the current route/controller/DTO implementation. See the [Documentation Index](README.md) for testing, security audits, workstream handoffs and module notes.
