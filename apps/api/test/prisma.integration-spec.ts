
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { randomUUID } from 'node:crypto';

describe('Prisma PostgreSQL Integration Tests', () => {
  let prisma: PrismaClient;

  const testEmail = `integration-${randomUUID()}@example.com`;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is required for integration tests',
      );
    }

    const url = new URL(connectionString);

    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      url.port !== '5433' ||
      url.pathname !== '/secureloginauth_test'
    ) {
      throw new Error(
        'Refusing to run against a non-test database',
      );
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });

    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;

    try {
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('User integration', () => {
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

  describe('Session integration', () => {
    it('4. should create a session associated with a user', async () => {
      const email = `session-${randomUUID()}@example.com`;
      const refreshTokenHash = `hash-${randomUUID()}`;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'integration-test-hash',
        },
      });

      try {
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            refreshTokenHash,
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        expect(session.id).toBeDefined();
        expect(session.userId).toBe(user.id);
        expect(session.refreshTokenHash).toBe(refreshTokenHash);
        expect(session.revokedAt).toBeNull();
      } finally {
        await prisma.user.delete({
          where: { id: user.id },
        });
      }
    });

    it('5. should retrieve sessions through user relationships', async () => {
      const email = `relation-${randomUUID()}@example.com`;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'integration-test-hash',
          sessions: {
            create: {
              refreshTokenHash: `hash-${randomUUID()}`,
              expiresAt: new Date(Date.now() + 3600000),
            },
          },
        },
      });

      try {
        const result = await prisma.user.findUnique({
          where: { id: user.id },
          include: { sessions: true },
        });

        expect(result).not.toBeNull();
        expect(result?.sessions).toHaveLength(1);
        expect(result?.sessions[0]?.userId).toBe(user.id);
      } finally {
        await prisma.user.delete({
          where: { id: user.id },
        });
      }
    });

    it('6. should reject duplicate refresh token hashes', async () => {
      const email = `duplicate-${randomUUID()}@example.com`;
      const refreshTokenHash = `hash-${randomUUID()}`;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'integration-test-hash',
        },
      });

      try {
        await prisma.session.create({
          data: {
            userId: user.id,
            refreshTokenHash,
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        await expect(
          prisma.session.create({
            data: {
              userId: user.id,
              refreshTokenHash,
              expiresAt: new Date(Date.now() + 3600000),
            },
          }),
        ).rejects.toMatchObject({
          code: 'P2002',
        });
      } finally {
        await prisma.user.delete({
          where: { id: user.id },
        });
      }
    });

    it('7. should revoke an active session', async () => {
      const email = `revoke-${randomUUID()}@example.com`;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'integration-test-hash',
        },
      });

      try {
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            refreshTokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        expect(session.revokedAt).toBeNull();

        const revoked = await prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });

        expect(revoked.revokedAt).toBeInstanceOf(Date);

        const activeSession = await prisma.session.findFirst({
          where: {
            id: session.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

        expect(activeSession).toBeNull();
      } finally {
        await prisma.user.delete({
          where: { id: user.id },
        });
      }
    });

    it('8. should cascade delete sessions when a user is deleted', async () => {
      const email = `cascade-${randomUUID()}@example.com`;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'integration-test-hash',
        },
      });

      try {
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            refreshTokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        await prisma.user.delete({
          where: { id: user.id },
        });

        const deletedSession = await prisma.session.findUnique({
          where: { id: session.id },
        });

        expect(deletedSession).toBeNull();
      } finally {
        await prisma.user.deleteMany({
          where: { id: user.id },
        });
      }
    });
  });
});
