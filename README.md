# School Portal API

A multi-tenant backend API for managing schools, users, and onboarding workflows for the MultiSchool platform.

---

## Overview

The School Portal API powers a multi-tenant school management system where each registered school operates as an isolated tenant.

The API handles:

- User registration and authentication
- Automatic school (tenant) creation
- School onboarding and verification
- School profile management
- Document uploads for verification
- Tenant-based access control

Each school is treated as a separate tenant, with data scoped strictly to its organization.

---

## Tech Stack

- Node.js
- Express.js
- MongoDB
- JWT Authentication
- Cloud storage (for document uploads)

---

## Multi-Tenancy Model

- Each school represents a **tenant**
- A tenant is created automatically during user registration
- Users are always scoped to a single school
- All `/school` routes are tenant-aware and protected
- Data access is restricted using `schoolId` derived from the JWT

---


### 1. Clone the repository

```bash
git clone <repo-url>
cd <repo-folder>
