# Team Management & Agency Showcase Platform (V1.0)

Enterprise-grade **FastAPI + SQLAlchemy 2.0 (Async) + Pydantic V2 + Casbin RBAC** backend and dual-mode SPA for managing multi-team software engineering workspaces, Kanban sprints, public agency portfolios, and client consultation inquiries.

---

## Architecture Highlights

- **Strict Multi-Team Isolation & Casbin RBAC:** Role-based access control (`super_admin`, team `admin`, `developer`, `viewer`) enforced via async Casbin policies and database-backed resource guards (`src/security/guards.py`).
- **Hardened Dual-Token JWT Authentication:** Separate signing secrets for access (`SECRET_KEY`) and rotational refresh tokens (`REFRESH_SECRET_KEY`), atomic compare-and-swap refresh token consumption (`consume_session_atomically`), replay attack family revocation, and immediate session/token invalidation via `security_version`.
- **Function-Scoped Transactional Integrity:** Unified `Depends(get_session, scope="function")` dependency guaranteeing `await session.commit()` completes before HTTP response serialization.
- **Public Showcase & Inquiry Portal:** Read-only public showcase (`/api/v1/public/*`) with configurable `Cache-Control` headers, opt-in member directory (`is_public_member=False` by default), and rate-limited client consultation intake with honeypot bot protection.

---

## Quick Start

### 1. Install Dependencies
```bash
uv sync --frozen
```

### 2. Run Database Migrations
```bash
uv run alembic upgrade head
```

### 3. Bootstrap Policies & Administrator Account
```bash
uv run python manage.py seed-policies
uv run python manage.py create-admin
```

*(Optional for local development only — blocked when `ENVIRONMENT=prod`)*:
```bash
uv run python manage.py seed-demo
```

### 4. Start the Application Server
```bash
uv run uvicorn src.main:app --reload
```

---

## Management CLI (`manage.py`)

| Command | Description |
| :--- | :--- |
| `uv run python manage.py init-db` | Initialize database tables and seed default Casbin RBAC policies |
| `uv run python manage.py seed-policies` | Idempotently reset and re-seed default Casbin RBAC rules |
| `uv run python manage.py create-admin` | Interactively create a `Super Admin` account (`is_public_member=False`) |
| `uv run python manage.py purge-sessions` | Purge expired or revoked refresh token sessions from `refresh_sessions` |
| `uv run python manage.py seed-demo` | Populate local development demo data (blocked in `prod`) |

---

## Health Probes & Testing

- **Liveness Probe:** `GET /health`
- **Readiness Probe (DB Connectivity):** `GET /health/ready`
- **Run Full Test Suite (Clean-Clone Isolated):**
  ```bash
  uv run --frozen pytest -v
  ```

