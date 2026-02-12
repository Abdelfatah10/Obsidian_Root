# Quick Start Guide

## Get Started in 5 Minutes

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Create .env File
```bash
cp .env.example .env
```

### 3️⃣ Configure Database
Get your PostgreSQL connection string and add to `.env`:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

### 4️⃣ Run Migrations
```bash
npx prisma migrate dev --name init
```

### 5️⃣ Start Server
```bash
npm run dev
```

✅ Server running at `http://localhost:3000`

---

## 🧪 Test Endpoints

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. Register User
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

---

## 📋 Checklist

- [ ] Node.js v18+ installed
- [ ] PostgreSQL configured
- [ ] .env file created with all variables
- [ ] Database migrations run
- [ ] Server starts without errors
- [ ] Test endpoints working

---

## 🔗 Useful Links

- 📚 [Full API Documentation](./API_DOCUMENTATION.md)
- 📖 [Setup Guide](./README.md)
- 🗄️ [Database Schema](./PRISMA_SETUP.md)
- 🌐 [Express.js Docs](https://expressjs.com/)

---

## ⚠️ Common Issues

### Port Already in Use
```bash
# Change PORT in .env or kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error
```bash
# Test connection
psql postgresql://user:password@host:port/database
```

### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📁 Project Structure

```
Backend/
├── src/
│   ├── controllers/    # Business logic
│   ├── routes/         # API endpoints
│   ├── middleware/     # Custom middleware
│   ├── services/       # External services
│   ├── models/         # Data models
│   └── utils/          # Utilities
├── prisma/
│   └── schema.prisma   # Database schema
├── uploads/            # Uploaded files
└── .env               # Configuration
```

---

## 🚀 What's Included

✅ Authentication (Register, Login, Email Verification)
✅ Google OAuth 2.0
✅ Password Management (Forgot, Reset, Change)
✅ User Management (Profile, Admin Controls)
✅ File Upload (Profile Photos)
✅ JWT Token Management
✅ Email Notifications
✅ Role-Based Access Control
✅ Comprehensive Error Handling
✅ Complete API Documentation

---

## 💡 Tips

1. **Email Verification:** Check spam folder for verification emails
2. **Google OAuth:** Get credentials from [Google Cloud Console](https://console.cloud.google.com/)
3. **Database:** Use [Supabase](https://supabase.com/) for free PostgreSQL hosting
4. **Testing:** Use Postman for API testing
5. **Development:** Use `npm run dev` for auto-reloading

---

Ready? Start the server and explore the API! 🎉
