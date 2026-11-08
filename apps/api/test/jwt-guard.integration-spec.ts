
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';

describe('JwtAuthGuard PostgreSQL Integration', () => {
  let prisma: PrismaService;
  let jwtService: JwtService;
  let guard: JwtAuthGuard;

  const createdUserIds: string[] = [];

  function createContext(authorization?: string) {
    const request: {
      headers: { authorization?: string };
      user?: {
        id: string;
        sessionId: string;
      };
    } = {
      headers: {},
    };

    if (authorization !== undefined) {
      request.headers.authorization = authorization;
    }

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  async function createUserAndSession() {
    const user = await prisma.user.create({
      data: {
        email: `jwt-guard-${randomUUID()}@example.com`,
        passwordHash: 'integration-test-hash',
      },
    });

    createdUserIds.push(user.id);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: `hash-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const accessToken = await jwtService.signAsync({
      sub: user.id,
      sid: session.id,
    });

    return { user, session, accessToken };
  }

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

    prisma = new PrismaService();

    jwtService = new JwtService({
      secret: 'jwt-guard-integration-test-secret',
      signOptions: {
        algorithm: 'HS256',
        expiresIn: 900,
      },
      verifyOptions: {
        algorithms: ['HS256'],
      },
    });

    guard = new JwtAuthGuard(jwtService, prisma);

    await prisma.$connect();
  });

  afterEach(async () => {
    const ids = createdUserIds.splice(0);

    if (ids.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: ids },
        },
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('1. should allow a valid JWT with an active session', async () => {
    const { user, session, accessToken } =
      await createUserAndSession();

    const { context, request } = createContext(
      `Bearer ${accessToken}`,
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: user.id,
      sessionId: session.id,
    });
  });

  it('2. should reject an expired JWT', async () => {
    const { user, session } = await createUserAndSession();

    const expiredToken = await jwtService.signAsync(
      {
        sub: user.id,
        sid: session.id,
      },
      {
        expiresIn: -10,
      },
    );

    const { context } = createContext(
      `Bearer ${expiredToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('3. should reject an invalid JWT signature', async () => {
    const { user, session } = await createUserAndSession();

    const otherJwtService = new JwtService({
      secret: 'different-signing-secret',
      signOptions: {
        algorithm: 'HS256',
      },
    });

    const invalidToken = await otherJwtService.signAsync({
      sub: user.id,
      sid: session.id,
    });

    const { context } = createContext(
      `Bearer ${invalidToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('4. should reject a revoked database session', async () => {
    const { session, accessToken } =
      await createUserAndSession();

    await prisma.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
      },
    });

    const { context } = createContext(
      `Bearer ${accessToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('5. should reject an expired database session', async () => {
    const { session, accessToken } =
      await createUserAndSession();

    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: new Date(Date.now() - 60000),
      },
    });

    const { context } = createContext(
      `Bearer ${accessToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('6. should reject a deleted user session', async () => {
    const { user, session, accessToken } =
      await createUserAndSession();

    await prisma.user.delete({
      where: { id: user.id },
    });

    const deletedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });

    expect(deletedSession).toBeNull();

    const { context } = createContext(
      `Bearer ${accessToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('7. should reject a JWT referencing another user session', async () => {
    const userA = await createUserAndSession();
    const userB = await createUserAndSession();

    const mismatchedToken = await jwtService.signAsync({
      sub: userA.user.id,
      sid: userB.session.id,
    });

    const { context } = createContext(
      `Bearer ${mismatchedToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const sessionB = await prisma.session.findUniqueOrThrow({
      where: { id: userB.session.id },
    });

    expect(sessionB.userId).toBe(userB.user.id);
    expect(sessionB.revokedAt).toBeNull();
  });

  
  it('8. should reject a missing authorization header', async () => {
    const { context } = createContext();

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('9. should reject an incorrect authorization scheme', async () => {
    const { accessToken } = await createUserAndSession();

    const { context } = createContext(
      `Basic ${accessToken}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('10. should reject an empty Bearer token', async () => {
    const { context } = createContext('Bearer ');

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('11. should reject extra authorization header values', async () => {
    const { accessToken } = await createUserAndSession();

    const { context } = createContext(
      `Bearer ${accessToken} unexpected`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('12. should reject a JWT missing the sub claim', async () => {
    const { session } = await createUserAndSession();

    const token = await jwtService.signAsync({
      sid: session.id,
    });

    const { context } = createContext(
      `Bearer ${token}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('13. should reject a JWT missing the sid claim', async () => {
    const { user } = await createUserAndSession();

    const token = await jwtService.signAsync({
      sub: user.id,
    });

    const { context } = createContext(
      `Bearer ${token}`,
    );

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

});
