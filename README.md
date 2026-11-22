# TTS – Talep Takip Sistemi (IT Request Tracking System)

A full-stack web application for tracking IT support requests, built during my summer internship at KEPSAŞ (Kayseri Elektrik Perakende Satış A.Ş.), 22.06.2026 – 03.08.2026. It is a learning reproduction of the request workflow used in the company's IT department.

Employees report hardware and software problems, department managers approve or reject them, the administrator assigns approved requests to a technician, and the technician resolves them. Every step is recorded and the people involved are notified by e-mail.

## Features

- **Four roles** with separate screens: user, manager, technician (sub-admin) and admin
- **Approval workflow**: the manager of the requester's department is found automatically
- **Assignment** of approved requests to technicians, with re-assignment and removal
- **Comments and full change history** (audit trail) on every request
- **E-mail notifications** (Nodemailer + Gmail SMTP), sent without blocking the request
- **Automatic category suggestion** while the user types the description, using a separate ML service ([talep-siniflandirma](https://github.com/alibayraktar00/talep-siniflandirma)); if the service is down, a keyword-based fallback takes over
- **Admin dashboard** with status counts and the category distribution of the last 7 days
- **User management**: roles, departments, active / passive accounts

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Axios |
| Backend | Node.js, Express (28 REST endpoints) |
| Database | MySQL 8 (6 tables, `utf8mb4_turkish_ci`) |
| Security | JWT, bcrypt, Helmet, CORS, express-rate-limit, parameterized SQL |
| E-mail | Nodemailer (Gmail SMTP) |
| ML service | Python, Flask, scikit-learn, Sentence-Transformers |

## Architecture

```
React SPA  ──HTTP/JSON──►  Express REST API  ──►  MySQL
 (port 3000)                 (port 5000)
                               │
                               ├──► Gmail SMTP          (notifications)
                               └──► Flask ML service    (category prediction, port 5002)
```

### Request workflow

```
Employee creates request ─► Manager approves / rejects ─► Admin assigns ─► Technician resolves
        (pending)                    (open)                                (in_progress → resolved)
```

If the requester's department has no manager, the request starts directly as `open`.

### Database

| Table | Purpose |
|---|---|
| `users` | Accounts, bcrypt password hash, role, department, active flag |
| `categories` | The 20 request categories (hardware + software) |
| `tickets` | Requests: type, status, manager decision, assigned technician |
| `ticket_comments` | Comments on a request |
| `ticket_history` | Audit trail: field, old value, new value, who, when |
| `login_logs` | Every login attempt with IP address and result |

## Project structure

```
TTS/
├── package.json            ← runs backend and frontend together
├── backend/
│   ├── server.js           ← Express app, security middleware, /predict
│   ├── authRoutes.js       ← register, login, profile, password
│   ├── ticketRoutes.js     ← tickets, approval, assignment, comments, dashboard
│   ├── userRoutes.js       ← user management (admin)
│   ├── mailer.js           ← e-mail notifications
│   ├── db.js               ← MySQL connection pool
│   ├── schema.sql          ← database schema (safe to re-run)
│   ├── seed_demo.js        ← demo accounts and sample requests
│   └── .env.example
└── frontend/
    └── src/
        ├── api.js          ← Axios instance (adds JWT, handles 401)
        ├── App.jsx         ← role-based routing
        ├── LoginPage.jsx, Dashboard.jsx, TalepPage.jsx, TicketListPage.jsx,
        ├── TicketDetailPage.jsx, ManagerPage.jsx, SubAdminPage.jsx,
        └── UserManagePage.jsx, SubAdminManagePage.jsx, SettingsPage.jsx, ...
```

## Getting started

### Requirements

- Node.js 18+
- MySQL 8
- *(optional)* Python 3.11 for the category prediction service

### 1. Database

```bash
mysql -u root -p < backend/schema.sql
```

This creates the `tts_db` database, the tables and the 20 categories.

### 2. Environment variables

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env` with your database password, a long random `JWT_SECRET` and, if you want e-mail notifications, a Gmail address with an **app password**. The `.env` file is ignored by Git.

### 3. Install and run

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm start
```

`npm start` runs the backend (http://localhost:5000) and the frontend (http://localhost:3000) together.

> On Windows PowerShell, if script execution is disabled, use `npm.cmd` instead of `npm`.

### 4. Demo data (optional)

```bash
cd backend
node seed_demo.js
```

Creates one account per role (`demo_admin`, `demo_yonetici`, `demo_teknisyen`, `demo_kullanici`) and sample requests in every state. The demo password is defined in `seed_demo.js`. Running it again resets the demo data. **For local development only.**

### 5. Category prediction service (optional)

Clone and start [talep-siniflandirma](https://github.com/alibayraktar00/talep-siniflandirma); it listens on `http://127.0.0.1:5002`. Without it, TTS uses the built-in keyword matching.

## API overview

The endpoints below are under `/api` (except `/predict`) and, apart from register and login, require a `Bearer` JWT.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `PUT /auth/password`, `DELETE /auth/me` |
| Requests | `GET /tickets`, `GET /tickets/my`, `GET /tickets/:id`, `POST /tickets`, `PATCH /tickets/:id`, `POST /tickets/:id/comments`, `GET /categories` |
| Manager | `GET /tickets/manager`, `GET /tickets/manager/stats`, `PUT /tickets/:id/manager-action` |
| Admin | `GET /dashboard/summary`, `GET /admin/unassigned-tickets`, `GET /admin/assigned-tickets`, `PUT /tickets/:id/assign`, `GET /sub-admins`, `POST /admin/create-sub-admin` |
| Technician | `GET /sub-admin/tickets` |
| Users (admin) | `GET /users`, `PATCH /users/:id`, `DELETE /users/:id` |
| Other | `POST /predict` (category suggestion), `GET /health` |

## Security notes

- Passwords are stored only as bcrypt hashes; new accounts are always created as normal users.
- Every endpoint checks the caller's role; object-level checks ensure a manager or technician can only act on their own requests.
- Disabled accounts lose access immediately (checked on every request, not only at token expiry).
- Login: max 20 attempts / 15 min per client; API: max 500 requests / 15 min.
- All secrets are read from environment variables and never committed.

## Related repositories

- [talep-siniflandirma](https://github.com/alibayraktar00/talep-siniflandirma) – hybrid request classifier (TF-IDF + LinearSVC and MiniLM embeddings)
- [epdk-mevzuat-rag](https://github.com/alibayraktar00/epdk-mevzuat-rag) – the second internship project, a local RAG assistant for EPDK legislation

## Author

Ali Bayraktar – Abdullah Gül University, Computer Engineering
