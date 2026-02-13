import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// In Next.js dev, modules can be re-evaluated frequently (HMR). Creating a new PrismaClient each time
// can lead to too many connections and "Transaction not found" errors if an old client disconnects.
export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
