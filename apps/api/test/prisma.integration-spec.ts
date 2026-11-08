
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

describe('Prisma PostgreSQL Integration Tests', () => {
  let prisma: PrismaClient;
  let testEmail: string;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    const url = new URL(connectionString);

    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '5433' ||
      url.pathname !== '/secureloginauth_test'
    ) {
      throw new Error('Refusing to run against a non-test database');
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });

    await prisma.$connect();
    testEmail = `integration-${randomUUID()}@example.com`;
  });

  afterAll(async () => {
    if (!prisma) return;

    if (testEmail) {
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
    }

    await prisma.$disconnect();
  });

  it('1. should create a user in PostgreSQL', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'integration-test-hash',
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(testEmail);
  });

  it('2. should retrieve the created user', async () => {
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    expect(user).not.toBeNull();
    expect(user?.email).toBe(testEmail);
  });

  it('3. should reject duplicate email addresses', async () => {
    await expect(
      prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: 'another-test-hash',
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
