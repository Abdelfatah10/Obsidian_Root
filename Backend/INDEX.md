# 📖 Hackathon Backend - Complete Index

## 🎯 Start Here

**New to this project?** Follow these steps:
1. Read [QUICK_START.md](./QUICK_START.md) - Get running in 5 minutes
2. Review [README.md](./README.md) - Full setup and deployment guide
3. Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - All endpoints

---

## 📚 Documentation

| Document | Purpose | Time |
|----------|---------|------|
| [QUICK_START.md](./QUICK_START.md) | Fast setup guide | 5 min |
| [README.md](./README.md) | Complete guide | 15 min |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | API reference | Reference |
| [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md) | What's implemented | 10 min |
| [BACKEND_CHECKLIST.md](./BACKEND_CHECKLIST.md) | Feature checklist | Reference |
| [PRISMA_SETUP.md](./PRISMA_SETUP.md) | Database info | Reference |

---

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev --name init

# Start development
npm run dev

# Start production
npm start

# View database
npx prisma studio
```

---

## 📋 What's Included

### Authentication (21 Endpoints)
- **10 Auth endpoints**: Register, Login, OAuth, Verify, Password Reset
- **9 User endpoints**: Profile, Upload, Search, Admin
- **2 System endpoints**: Health, Info

### Features
- ✅ JWT token system
- ✅ Email verification
- ✅ Google OAuth
- ✅ Password reset
- ✅ File uploads
- ✅ RBAC (Admin/User)
- ✅ Email notifications

### Infrastructure
- ✅ Express.js
- ✅ Prisma ORM
- ✅ PostgreSQL
- ✅ JWT Auth
- ✅ File Upload
- ✅ Email Service

---

## 🗂️ Project Structure

```
Backend/
├── Documentation
│   ├── README.md                 ← Main guide
│   ├── QUICK_START.md           ← 5 min setup
│   ├── API_DOCUMENTATION.md     ← All endpoints
│   ├── COMPLETION_SUMMARY.md    ← What's done
│   ├── BACKEND_CHECKLIST.md     ← Features list
│   ├── INDEX.md                 ← This file
│   └── PRISMA_SETUP.md          ← Database
│
├── Source Code (src/)
│   ├── app.js                   ← Express app
│   ├── server.js                ← Server entry
│   ├── controllers/             ← Business logic
│   ├── routes/                  ← API endpoints
│   ├── middleware/              ← Custom middleware
│   ├── services/                ← External services
│   ├── models/                  ← Database models
│   ├── config/                  ← Configuration
│   ├── utils/                   ← Utilities
│   ├── prisma/                  ← Database client
│   └── templates/               ← Email templates
│
├── Database (prisma/)
│   ├── schema.prisma            ← Database schema
│   └── migrations/              ← Migration files
│
├── Configuration
│   ├── .env                     ← Your secrets
│   ├── .env.example             ← Template
│   └── .gitignore               ← Git rules
│
├── Package
│   └── package.json             ← Dependencies
│
└── Uploads
    └── uploads/                 ← User files (auto-created)
```

---

## 🔗 API Routes

### 🔐 Authentication - `/api/auth`
```
POST   /register           Create account
POST   /login              Login with email
POST   /login-google       Login with Google
POST   /verify-email       Verify email
POST   /forgot-password    Reset password request
POST   /reset-password     Reset password
POST   /refresh-token      Get new access token
POST   /logout             Logout
POST   /change-password    Change password (auth)
GET    /me                 Get current user
```

### 👥 Users - `/api/users`
```
GET    /me                 Get your profile
GET    /profile/:id        Get user profile
PUT    /me                 Update profile
POST   /avatar             Upload photo
GET    /                   All users (admin)
GET    /search             Search users (admin)
PUT    /:id/role           Change role (admin)
DELETE /:id                Delete user (admin)
GET    /stats/overview     Stats (admin)
```

### ⚙️ System
```
GET    /health             Health check
GET    /                   API info
```

---

## 💾 Environment Variables

```env
# Server Config
PORT=3000
NODE_ENV=development
DOMAIN_URL=http://localhost:9000

# App Info
APP_NAME=Hackathon_API
APP_VERSION=1.0.0
APP_DESCRIPTION=API for Hackathon

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com

# Email
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password

# JWT Secrets (generate random)
JWT_ACCESS_SECRET=random_string_min_32_chars
JWT_REFRESH_SECRET=random_string_min_32_chars
JWT_RESET_PASSWORD_SECRET=random_string_min_32_chars

# JWT Expiry
JWT_EXPIRES_IN_ACCESS=15m
JWT_EXPIRES_IN_REFRESH=7d
JWT_EXPIRES_IN_RESET_PASSWORD=15m
```

---

## 🧪 Test It Out

### 1. Check Health
```bash
curl http://localhost:3000/health
```

### 2. Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for all endpoints and examples.

---

## 🔐 Security Features

- ✅ Password hashing (bcryptjs)
- ✅ JWT token auth
- ✅ Email verification
- ✅ Secure cookies
- ✅ CORS configured
- ✅ Input validation
- ✅ Role-based access
- ✅ Error masking

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^5.2.1 | Web framework |
| @prisma/client | ^5.8.0 | ORM |
| jsonwebtoken | ^9.1.2 | JWT tokens |
| bcryptjs | ^2.4.3 | Password hashing |
| nodemailer | ^7.0.12 | Email |
| google-auth-library | ^10.5.0 | Google OAuth |
| multer | ^1.4.5-lts.1 | File upload |
| validator | ^13.11.0 | Input validation |
| cors | ^2.8.5 | CORS handling |
| cookie-parser | ^1.4.7 | Cookie parsing |
| dotenv | ^17.2.3 | Env vars |

---

## 🚀 Getting Started

### Step 1: Install
```bash
npm install
```

### Step 2: Setup .env
```bash
cp .env.example .env
# Edit .env with your values
```

### Step 3: Database
```bash
npx prisma migrate dev --name init
```

### Step 4: Run
```bash
npm run dev
```

### Step 5: Test
Open browser or use cURL to test endpoints

---

## 📞 Support

1. **Setup Issues?** → Check [README.md](./README.md)
2. **API Questions?** → See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
3. **Quick Start?** → Read [QUICK_START.md](./QUICK_START.md)
4. **Errors?** → Check console logs, ensure .env is correct
5. **Database Issues?** → Review [PRISMA_SETUP.md](./PRISMA_SETUP.md)

---

## ✅ Checklist

- [ ] Read [QUICK_START.md](./QUICK_START.md)
- [ ] Install dependencies: `npm install`
- [ ] Setup .env file
- [ ] Configure database
- [ ] Run migrations: `npx prisma migrate dev`
- [ ] Start server: `npm run dev`
- [ ] Test endpoints
- [ ] Setup Google OAuth
- [ ] Configure email

---

## 📊 Statistics

- **21 API endpoints**
- **10 authentication endpoints**
- **9 user management endpoints**
- **2 system endpoints**
- **13 files in src/**
- **100% documented**
- **Production-ready**

---

## 🎯 Key Features

- Complete authentication system
- User management with RBAC
- Email verification workflow
- Google OAuth 2.0
- Password reset system
- Profile management
- File uploads
- Admin dashboard ready
- Comprehensive error handling
- Full API documentation

---

## 🔗 Related Links

- [Express Docs](https://expressjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [JWT Info](https://jwt.io/)
- [Google OAuth](https://developers.google.com/identity/protocols/oauth2)

---

## 📝 License

GPL-3.0 License

---

## 👨‍💼 Author

**Djaballah Abdelfatah**

---

## 🎉 Ready?

Start with [QUICK_START.md](./QUICK_START.md) and you'll be running in 5 minutes!

**Happy Coding!** 🚀
