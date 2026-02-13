import 'dotenv/config';

const required = [
    'PORT',
    'NODE_ENV',
    'DOMAIN_URL',
    'APP_NAME',
    'APP_VERSION',
    'APP_DESCRIPTION',
    'GOOGLE_CLIENT_ID',
    'GEMINI_API_KEY',
    'EMAIL_USER',
    'EMAIL_PASS',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_RESET_PASSWORD_SECRET',
    'JWT_EXPIRES_IN_ACCESS',
    'JWT_EXPIRES_IN_REFRESH',
    'JWT_EXPIRES_IN_RESET_PASSWORD'
];

required.forEach((key) => {
    if (!process.env[key]) {
        throw new Error(`❌ Missing environment variable: ${key}`);
    }
});

export const ENV = {
    PORT: Number(process.env.PORT),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DOMAIN_URL: process.env.DOMAIN_URL,
    APP_NAME: process.env.APP_NAME,
    APP_VERSION: process.env.APP_VERSION,
    APP_DESCRIPTION: process.env.APP_DESCRIPTION,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_RESET_PASSWORD_SECRET: process.env.JWT_RESET_PASSWORD_SECRET,
    JWT_EXPIRES_IN_ACCESS: process.env.JWT_EXPIRES_IN_ACCESS,
    JWT_EXPIRES_IN_REFRESH: process.env.JWT_EXPIRES_IN_REFRESH,
    JWT_EXPIRES_IN_RESET_PASSWORD: process.env.JWT_EXPIRES_IN_RESET_PASSWORD,
    EXTENSION_URL: process.env.EXTENSION_URL || ''
};
