# 🚀 Obsidian Guard — Backend API

> Node.js + Express REST API powering the Obsidian Guard cybersecurity platform.

---

## ✨ Features

- **Authentication** — Register, login, email verification, Google OAuth 2.0
- **JWT Tokens** — Access + refresh tokens with HTTP-only cookies
- **Role-Based Access** — USER and ENTERPRISE roles
- **Enterprise Management** — Company profiles, employee invitations (single + bulk)
- **Employee Activity Tracking** — Log URL visits, phishing detections, site blocks from extension
- **Send Emails to Employees** — Enterprise can email employees with delivery tracking
- **Gmail Integration** — OAuth-based inbox sync and email analysis
- **Email Phishing Detection** — ML model + Gemini AI analysis with confidence scoring
- **URL & Domain Analysis** — Screenshot capture, visual similarity, DNS intelligence
- **File Scanning** — VirusTotal integration for malware detection
- **Chrome Extension API** — Extension login, activity reporting, status tracking

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Express 5** | Web framework |
| **Prisma ORM** | Database access |
| **PostgreSQL** | Relational database |
| **JWT** | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Nodemailer** | Email sending (Gmail) |
| **Google APIs** | OAuth, Gmail, Gemini AI |
| **VirusTotal API** | File malware scanning |
| **Multer** | File uploads |
| **Sharp** | Image processing |

---

## 📁 Project Structure

```
Backend/
├── src/
│   ├── app.js                    # Express app setup & middleware
│   ├── server.js                 # Server entry point
│   ├── config/
│   │   ├── env.js                # Environment variable validation
│   │   └── db.js                 # Database connection
│   ├── controllers/
│   │   ├── auth.controller.js    # Auth (register, login, verify, reset)
│   │   ├── user.controller.js    # User profile management
│   │   ├── company.controller.js # Enterprise, employees, activities
│   │   ├── email.controller.js   # Gmail sync, email analysis
│   │   ├── url.controller.js     # URL scanning
│   │   ├── file.controller.js    # File scanning
│   │   └── phishing.controller.js# Phishing detection engine
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT authentication & role authorization
│   │   ├── errorHandler.js       # Global error handler
│   │   └── uploadMiddleware.js   # File upload config
│   ├── models/
│   │   └── User.js               # User model helpers
│   ├── prisma/
│   │   └── client.js             # Prisma client singleton
│   ├── routes/
│   │   ├── auth.routes.js        # /api/auth/v1/*
│   │   ├── user.routes.js        # /api/users/v1/*
│   │   ├── company.routes.js     # /api/company/v1/*
│   │   ├── email.routes.js       # /api/email/v1/*
│   │   ├── url.routes.js         # /api/url/v1/*
│   │   ├── file.routes.js        # /api/file/v1/*
│   │   └── phishing.routes.js    # /api/phishing/v1/*
│   ├── services/
│   │   ├── authService.js        # Google token verification
│   │   ├── jwtService.js         # JWT generation & verification
│   │   ├── mailerService.js      # Nodemailer transporter
│   │   ├── gmailService.js       # Gmail OAuth & email fetching
│   │   ├── aiService.js          # Gemini AI integration
│   │   ├── urlAnalysisService.js # URL analysis engine
│   │   ├── virusTotalService.js  # VirusTotal API client
│   │   └── googleService.js      # Google services
│   └── utils/
│       ├── catchAsync.js         # Async error wrapper
│       └── constants/            # Status codes, messages, roles
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
├── uploads/                      # File uploads directory
├── package.json
└── .env                          # Environment variables
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **PostgreSQL** database
- **Gmail account** with App Password

### Install

```bash
cd Backend
npm install
```

### Environment Variables

Create `.env` in `Backend/`:

```env
# Server
PORT=3000
NODE_ENV=development
DOMAIN_URL=http://localhost:9000

# App
APP_NAME=ObsidianGuard
APP_VERSION=1.0.0
APP_DESCRIPTION=AI-Powered Phishing Detection Platform

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Google
GOOGLE_CLIENT_ID=your_google_client_id
GEMINI_API_KEY=your_gemini_api_key

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# JWT
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_RESET_PASSWORD_SECRET=your_reset_secret
JWT_EXPIRES_IN_ACCESS=15m
JWT_EXPIRES_IN_REFRESH=7d
JWT_EXPIRES_IN_RESET_PASSWORD=15m

# External APIs
BROWSERLESS_API_KEY=your_browserless_key
VIRUSTOTAL_API_KEY=your_virustotal_key
```

### Database Setup

```bash
npx prisma generate
npx prisma db push        # Push schema to DB
# or
npx prisma migrate dev    # Create migration files
```

### Run

```bash
npm run dev   # Development (nodemon)
npm start     # Production
```

Server starts at **http://localhost:3000**

---

## 🛣️ API Endpoints

### Authentication — `/api/auth/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | — | Register with email/password/role |
| POST | `/login` | — | Login with email/password |
| POST | `/login-google` | — | Login with Google OAuth |
| POST | `/verify-email` | — | Verify email with code |
| POST | `/forgot-password` | — | Request password reset |
| POST | `/verify-reset-code` | — | Verify reset code |
| POST | `/reset-password` | — | Reset password |
| POST | `/refresh-token` | — | Refresh access token |
| POST | `/logout` | ✅ | Logout (clear cookies) |
| POST | `/change-password` | ✅ | Change password |
| GET | `/me` | ✅ | Get current user |

### Users — `/api/users/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | ✅ | Get current user profile |
| PUT | `/me` | ✅ | Update profile |
| GET | `/profile/:id` | — | Get user by ID |

### Enterprise — `/api/company/v1`

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/profile` | ✅ | ENTERPRISE | Get company profile |
| PUT | `/profile` | ✅ | ENTERPRISE | Create/update company |
| POST | `/employees/invite` | ✅ | ENTERPRISE | Invite employee |
| POST | `/employees/bulk-invite` | ✅ | ENTERPRISE | Bulk invite |
| GET | `/employees` | ✅ | ENTERPRISE | List employees (paginated) |
| GET | `/employees/stats` | ✅ | ENTERPRISE | Employee statistics |
| GET | `/employees/status/:status` | ✅ | ENTERPRISE | Filter by status |
| PUT | `/employees/:id` | ✅ | ENTERPRISE | Update employee |
| DELETE | `/employees/:id` | ✅ | ENTERPRISE | Remove employee |
| POST | `/employees/:id/resend` | ✅ | ENTERPRISE | Resend invitation |
| POST | `/invite/accept` | — | — | Accept invitation |
| POST | `/invite/reject` | — | — | Reject invitation |
| POST | `/extension/installed` | — | — | Mark extension installed |

### Gmail & Emails — `/api/email/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/gmail/auth` | ✅ | Get Gmail OAuth URL |
| GET | `/gmail/callback` | — | Gmail OAuth callback |
| GET | `/gmail/status` | ✅ | Gmail connection status |
| DELETE | `/gmail/disconnect` | ✅ | Disconnect Gmail |
| POST | `/gmail/sync` | ✅ | Sync Gmail emails |
| GET | `/gmail/fetch` | ✅ | Fetch Gmail emails |
| GET | `/emails` | ✅ | Get stored emails |
| GET | `/emails/:id` | ✅ | Get email by ID |
| POST | `/emails/:id/analyze` | ✅ | Analyze email |
| POST | `/analyze` | ✅ | Analyze email content |
| POST | `/bulk-analyze` | ✅ | Bulk analyze emails |
| GET | `/dashboard/stats` | ✅ | Dashboard statistics |

### URL Scanning — `/api/url/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scan` | ✅ | Scan URL |
| GET | `/history` | ✅ | Scan history |

### File Scanning — `/api/file/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/scan` | ✅ | Upload & scan file |
| GET | `/history` | ✅ | Scan history |

### Phishing — `/api/phishing/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/analyze` | — | Analyze URL for phishing |

---

## 🗄️ Database Models

| Model | Table | Description |
|-------|-------|-------------|
| **User** | `users` | User accounts, auth, Gmail tokens |
| **VerificationCode** | `verification_codes` | Email verify & reset codes |
| **Entreprise** | `entreprises` | Company profiles |
| **CompanyEmployee** | `company_employees` | Employee invitations & extension tracking |
| **EmployeeActivity** | `employee_activities` | Activity logs from extension |
| **CompanyEmail** | `company_emails` | Enterprise email campaigns |
| **Email** | `emails` | Synced Gmail emails with analysis |
| **UrlScan** | `url_scans` | URL scan results |
| **FileScan** | `file_scans` | File scan results |

---

## 🔒 Security

- Password hashing with bcryptjs (12 rounds)
- JWT access tokens (15min) + refresh tokens (7d) in HTTP-only cookies
- Role-based middleware (`authenticate`, `authorize`)
- CORS whitelist with chrome-extension support
- Input validation (email format, password strength)
- Secure cookie flags (httpOnly, sameSite, secure in production)

---

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm start` | Start production server |
