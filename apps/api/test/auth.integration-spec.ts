
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { hashRefreshToken } from '../src/auth/utils/refresh-token.util.js';

describe('AuthService PostgreSQL Integration', () => {
  let prisma: PrismaService;
  let authService: AuthService;
  let jwtService: JwtService;

  const createdUserIds: string[] = [];
  const password = 'SecureTestPassword2026!';

  function uniqueEmail() {
    return `auth-integration-${randomUUID()}@example.com`;
  }

  async function createUser() {
    const email = uniqueEmail();

    const result = await authService.register({
      email,
      password,
    });

    createdUserIds.push(result.user.id);

    return {
      id: result.user.id,
      email,
      password,
    };
  }

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
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
      secret: 'integration-test-only-secret',
      signOptions: {
        expiresIn: 900,
        algorithm: 'HS256',
      },
      verifyOptions: {
        algorithms: ['HS256'],
      },
    });

    authService = new AuthService(prisma, jwtService);

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

  it('1. should register a user with an Argon2id hash', async () => {
    const user = await createUser();

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(stored.email).toBe(user.email);
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);

    expect(
      await argon2.verify(stored.passwordHash, password),
    ).toBe(true);

    expect(stored.passwordHash).not.toBe(password);
  });

  it('2. should reject duplicate registration', async () => {
    const user = await createUser();

    await expect(
      authService.register({
        email: user.email,
        password,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      await prisma.user.count({
        where: { email: user.email },
      }),
    ).toBe(1);
  });

  it('3. should login and create a real session', async () => {
    const user = await createUser();

    const result = await authService.login({
      email: user.email,
      password,
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.tokenType).toBe('Bearer');

    const payload = await jwtService.verifyAsync<{
      sub: string;
      sid: string;
    }>(result.accessToken);

    expect(payload.sub).toBe(user.id);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: payload.sid },
    });

    expect(session.userId).toBe(user.id);
    expect(session.revokedAt).toBeNull();

    expect(session.refreshTokenHash).toBe(
      hashRefreshToken(result.refreshToken),
    );

    expect(session.refreshTokenHash).not.toBe(
      result.refreshToken,
    );
  });

  it('4. should reject incorrect login credentials', async () => {
    const user = await createUser();

    await expect(
      authService.login({
        email: user.email,
        password: 'IncorrectPassword2026!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      await prisma.session.count({
        where: { userId: user.id },
      }),
    ).toBe(0);
  });

  it('5. should rotate refresh tokens and reject reuse', async () => {
    const user = await createUser();

    const login = await authService.login({
      email: user.email,
      password,
    });

    const oldPayload = await jwtService.verifyAsync<{
      sub: string;
      sid: string;
    }>(login.accessToken);

    const refreshed = await authService.refreshAccessToken({
      refreshToken: login.refreshToken,
    });

    expect(refreshed.refreshToken).not.toBe(
      login.refreshToken,
    );

    const newPayload = await jwtService.verifyAsync<{
      sub: string;
      sid: string;
    }>(refreshed.accessToken);

    expect(newPayload.sub).toBe(user.id);
    expect(newPayload.sid).toBe(oldPayload.sid);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: oldPayload.sid },
    });

    expect(session.refreshTokenHash).toBe(
      hashRefreshToken(refreshed.refreshToken),
    );

    await expect(
      authService.refreshAccessToken({
        refreshToken: login.refreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('6. should logout and revoke a session', async () => {
    const user = await createUser();

    const login = await authService.login({
      email: user.email,
      password,
    });

    const result = await authService.logout(user.id, {
      refreshToken: login.refreshToken,
    });

    expect(result.message).toBe('Logout successful');

    const session = await prisma.session.findUniqueOrThrow({
      where: {
        refreshTokenHash: hashRefreshToken(
          login.refreshToken,
        ),
      },
    });

    expect(session.revokedAt).toBeInstanceOf(Date);

    await expect(
      authService.refreshAccessToken({
        refreshToken: login.refreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('7. should logout from all sessions', async () => {
    const user = await createUser();

    await authService.login({
      email: user.email,
      password,
    });

    await authService.login({
      email: user.email,
      password,
    });

    const result = await authService.logoutAll(user.id);

    expect(result.revokedSessions).toBe(2);

    const activeCount = await prisma.session.count({
      where: {
        userId: user.id,
        revokedAt: null,
      },
    });

    expect(activeCount).toBe(0);
  });

  it('8. should list active sessions', async () => {
    const user = await createUser();

    const login = await authService.login({
      email: user.email,
      password,
    });

    const payload = await jwtService.verifyAsync<{
      sid: string;
    }>(login.accessToken);

    const result = await authService.getActiveSessions(
      user.id,
      payload.sid,
    );

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.id).toBe(payload.sid);
    expect(result.sessions[0]?.isCurrentSession).toBe(true);
  });

  it('9. should revoke a selected session', async () => {
    const user = await createUser();

    const login = await authService.login({
      email: user.email,
      password,
    });

    const payload = await jwtService.verifyAsync<{
      sid: string;
    }>(login.accessToken);

    const result = await authService.revokeSession(
      user.id,
      payload.sid,
    );

    expect(result.message).toBe(
      'Session revoked successfully',
    );

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: payload.sid },
    });

    expect(session.revokedAt).toBeInstanceOf(Date);
  });

  it('10. should retrieve the current user', async () => {
    const user = await createUser();

    const result = await authService.getCurrentUser(
      user.id,
    );

    expect(result.id).toBe(user.id);
    expect(result.email).toBe(user.email);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result).not.toHaveProperty('passwordHash');
  });
});
