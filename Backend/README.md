# 🚀 Hackathon Backend API

A complete, production-ready Node.js + Express backend for the Hackathon template with authentication, user management, and file upload capabilities.

## ✨ Features

- ✅ **User Authentication** - Register, login, email verification
- ✅ **Google OAuth 2.0** - Social login integration
- ✅ **JWT Tokens** - Access and refresh token management
- ✅ **Password Management** - Forgot password, reset, and change password
- ✅ **User Management** - Profile management and admin controls
- ✅ **File Upload** - Profile photo uploads with image validation
- ✅ **Role-Based Access Control** - Admin and user roles
- ✅ **Email Notifications** - Verification and password reset emails
- ✅ **Error Handling** - Comprehensive error handling and validation
- ✅ **Database** - PostgreSQL with Prisma ORM
- ✅ **API Documentation** - Complete API reference
- ✅ **Security** - Password hashing, JWT, CORS, secure cookies

## 📋 Prerequisites

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **PostgreSQL** database (local or cloud)
- **Gmail account** (for email service)
- **Google OAuth credentials** (for social login)

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd Backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Server
PORT=3000
NODE_ENV=development
DOMAIN_URL=http://localhost:9000

# App Info
APP_NAME=Hackathon_API
APP_VERSION=1.0.0
APP_DESCRIPTION=API for Hackathon Template

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here

# Email Service
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET=your_super_secret_access_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_RESET_PASSWORD_SECRET=your_super_secret_reset_key_here

# JWT Expiration
JWT_EXPIRES_IN_ACCESS=15m
JWT_EXPIRES_IN_REFRESH=7d
JWT_EXPIRES_IN_RESET_PASSWORD=15m

# Database
DATABASE_URL=postgresql://user:password@host:port/database
```

### 4. Database Setup

#### Using Supabase (Recommended)
1. Create a project at [Supabase](https://supabase.com)
2. Get your database connection string
3. Update `DATABASE_URL` in `.env`

#### Using Local PostgreSQL
```bash
# Create database
createdb hackathon_db

# Update DATABASE_URL
DATABASE_URL=postgresql://user:password@localhost:5432/hackathon_db
```

### 5. Run Prisma Migrations
```bash
# Generate Prisma client
npx prisma generate

# Create tables
npx prisma migrate dev --name init

# View database with Prisma Studio
npx prisma studio
```

## 🚀 Running the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Server will start at `http://localhost:3000`

## 📚 API Documentation

Complete API documentation is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Quick API Overview

#### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/login-google` - Login with Google OAuth
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/change-password` - Change password (authenticated)

#### User Endpoints
- `GET /api/users/me` - Get current user profile
- `GET /api/users/profile/:id` - Get user profile by ID
- `PUT /api/users/me` - Update user profile
- `POST /api/users/avatar` - Upload profile photo
- `GET /api/users` - Get all users (admin)
- `GET /api/users/search` - Search users (admin)
- `PUT /api/users/:id/role` - Update user role (admin)
- `DELETE /api/users/:id` - Delete user (admin)
- `GET /api/users/stats/overview` - Get user statistics (admin)

## 🗂️ Project Structure

```
Backend/
├── src/
│   ├── app.js                 # Express app setup
│   ├── server.js              # Server entry point
│   ├── config/                # Configuration files
│   │   ├── env.js             # Environment variables
│   │   └── db.js              # Database connection
│   ├── controllers/           # Route controllers
│   │   ├── auth.controller.js # Auth logic
│   │   └── user.controller.js # User logic
│   ├── middleware/            # Custom middleware
│   │   ├── authMiddleware.js  # Authentication
│   │   ├── errorHandler.js    # Error handling
│   │   ├── roleMiddleware.js  # Role checking
│   │   └── uploadMiddleware.js # File uploads
│   ├── models/                # Data models
│   │   └── User.js            # User model
│   ├── prisma/                # Prisma client
│   │   └── client.js
│   ├── routes/                # API routes
│   │   ├── auth.routes.js     # Auth routes
│   │   └── user.routes.js     # User routes
│   ├── services/              # Business logic
│   │   ├── authService.js     # Auth service
│   │   ├── jwtService.js      # JWT management
│   │   ├── mailerService.js   # Email service
│   │   └── googleService.js   # Google OAuth
│   ├── utils/                 # Utilities
│   │   ├── catchAsync.js      # Async error handler
│   │   └── constants/         # Constants
│   │       ├── messages.js    # Message constants
│   │       ├── roles.js       # Role constants
│   │       └── statusCodes.js # HTTP status codes
│   └── templates/             # Email templates
│       └── emails/            # Email HTML templates
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── uploads/                   # Uploaded files (auto-created)
├── .env                       # Environment variables (local)
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies
├── README.md                  # This file
├── API_DOCUMENTATION.md       # API docs
└── PRISMA_SETUP.md            # Prisma setup guide
```

## 🔒 Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **JWT Tokens** - Secure token-based authentication
- **CORS** - Cross-origin resource sharing configuration
- **Cookie Security** - httpOnly, sameSite, secure flags
- **Email Verification** - Confirm user email before login
- **Password Reset** - Secure token-based password recovery
- **Input Validation** - Email format and password strength validation
- **Role-Based Access Control** - Admin and user roles
- **Error Masking** - Generic error messages in production

## 📧 Email Configuration

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Create an App-Specific Password:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2FA
   - Generate App Password for Mail
   - Use this password in `.env` as `EMAIL_PASS`

### Email Templates

Email templates are in `src/templates/emails/`:
- `verify-email.html` - Email verification
- `reset-password.html` - Password reset
- `welcome.html` - Welcome email

## 🔐 Google OAuth Setup

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web Application)
3. Add authorized redirect URIs
4. Get your Client ID and add to `.env`

## 🚢 Deployment

### Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong JWT secrets
- [ ] Configure production database
- [ ] Set secure `DOMAIN_URL`
- [ ] Enable HTTPS
- [ ] Set strong CORS origin
- [ ] Configure email service
- [ ] Set up Google OAuth for production URL
- [ ] Use environment management (e.g., GitHub Secrets)

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_ACCESS_SECRET=your_secret
# ... set all required variables

# Deploy
git push heroku main
```

### Deploy to Railway/Render

Follow their platform-specific deployment guides.

## 🧪 Testing

### Manual Testing with cURL

#### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### Get Current User (with token)
```bash
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Testing with Postman

Import the API collection and test all endpoints with provided examples.

## 🐛 Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Verify user has database permissions
- Check firewall rules

### Email Not Sending
- Verify Gmail App Password is correct
- Check 2FA is enabled on Google account
- Verify `EMAIL_USER` is correct
- Check spam folder for emails

### JWT Token Issues
- Ensure JWT secrets are set and strong
- Check token expiration
- Verify token format (Bearer <token>)

### CORS Errors
- Verify `DOMAIN_URL` matches your frontend domain
- Check `credentials: true` configuration
- Verify headers are correct

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development / production |
| DOMAIN_URL | Frontend URL | http://localhost:9000 |
| DATABASE_URL | Database connection | postgresql://user:pass@host/db |
| GOOGLE_CLIENT_ID | Google OAuth ID | xxx.apps.googleusercontent.com |
| EMAIL_USER | Gmail address | user@gmail.com |
| EMAIL_PASS | Gmail App Password | xxxx xxxx xxxx xxxx |
| JWT_ACCESS_SECRET | Access token secret | strong_random_string |
| JWT_REFRESH_SECRET | Refresh token secret | strong_random_string |
| JWT_RESET_PASSWORD_SECRET | Reset token secret | strong_random_string |

## 🤝 Contributing

Please follow the existing code style and structure. Make sure to:

1. Test all changes locally
2. Update documentation for new features
3. Follow the error handling patterns
4. Use meaningful commit messages

## 📄 License

This project is licensed under the GPL-3.0 License - see LICENSE file for details.

## 👥 Author

**Djaballah Abdelfatah**

## 📞 Support

For issues and feature requests, please create an issue in the repository.

## 🔗 Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Prisma Setup Guide](./PRISMA_SETUP.md)
- [Prisma ORM](https://www.prisma.io/)
- [Express.js](https://expressjs.com/)
- [JWT Documentation](https://jwt.io/)

---

**Happy Coding!** 🎉
