import { PrismaClient } from '@prisma/client';
import { ENV } from '../config/env.js';

const globalForPrisma = global;

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ENV.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

if (ENV.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
