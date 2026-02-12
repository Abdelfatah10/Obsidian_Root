import prisma from "../prisma/client.js";

export const connectDB = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log("📦 Database connected successfully!");
    } catch (error) {
        console.error("❌ Database connection failed:");
        console.error(error);
        process.exit(1);
    }
};
