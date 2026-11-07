import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { jwtExpiresInSeconds } from './config/jwt.config.js';
import { hashRefreshToken } from './utils/refresh-token.util.js';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const mockJwtService = {
    signAsync: vi.fn(),
  };

  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const validPassword = 'TestPassword2026!';

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a user with a hashed password', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        createdAt: testUser.createdAt,
      });

      const result = await service.register({
        email: 'TEST@example.com',
        password: validPassword,
      });

      expect(result.message).toBe('User registered successfully');

      expect(result.user.email).toBe(testUser.email);

      const createArgs = mockPrisma.user.create.mock.calls[0][0];

      expect(createArgs.data.email).toBe(testUser.email);

      expect(createArgs.data.passwordHash).not.toBe(validPassword);

      expect(
        await argon2.verify(createArgs.data.passwordHash, validPassword),
      ).toBe(true);
    });

    it('should reject duplicate emails', async () => {
      const prismaError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });

      mockPrisma.user.create.mockRejectedValue(prismaError);

      await expect(
        service.register({
          email: testUser.email,
          password: validPassword,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should log in with valid credentials', async () => {
      const passwordHash = await argon2.hash(validPassword);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        passwordHash,
      });

      mockPrisma.session.create.mockResolvedValue({
        id: 'session-123',
      });

      mockJwtService.signAsync.mockResolvedValue('mock-access-token');

      const result = await service.login({
        email: 'TEST@example.com',
        password: validPassword,
      });

      expect(result.message).toBe('Login successful');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(jwtExpiresInSeconds);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: testUser.email },
      });

      expect(mockPrisma.session.create).toHaveBeenCalledOnce();
    });

    it('should reject an unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: validPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });

    it('should reject an incorrect password', async () => {
      const passwordHash = await argon2.hash(validPassword);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        passwordHash,
      });

      await expect(
        service.login({
          email: testUser.email,
          password: 'WrongPassword2026!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });

    it('should include user ID and session ID in JWT payload', async () => {
      const passwordHash = await argon2.hash(validPassword);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        passwordHash,
      });

      mockPrisma.session.create.mockResolvedValue({
        id: 'session-456',
      });

      mockJwtService.signAsync.mockResolvedValue('mock-access-token');

      await service.login({
        email: testUser.email,
        password: validPassword,
      });

      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: testUser.id,
        sid: 'session-456',
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should rotate a refresh token and preserve the session ID', async () => {
      const oldRefreshToken = 'old-refresh-token';

      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: testUser.id,
      });

      mockPrisma.session.updateMany.mockResolvedValue({
        count: 1,
      });

      mockJwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refreshAccessToken({
        refreshToken: oldRefreshToken,
      });

      expect(result.accessToken).toBe('new-access-token');

      expect(result.refreshToken).not.toBe(oldRefreshToken);

      expect(result.expiresIn).toBe(jwtExpiresInSeconds);

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: {
          refreshTokenHash: hashRefreshToken(oldRefreshToken),
        },
        select: {
          id: true,
          userId: true,
        },
      });

      const rotationArgs = mockPrisma.session.updateMany.mock.calls[0][0];

      expect(rotationArgs.where.id).toBe('session-123');

      expect(rotationArgs.data.refreshTokenHash).toBe(
        hashRefreshToken(result.refreshToken),
      );

      expect(rotationArgs.data.refreshTokenHash).not.toBe(
        hashRefreshToken(oldRefreshToken),
      );

      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: testUser.id,
        sid: 'session-123',
      });
    });

    it('should reject an invalid refresh token', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken({
          refreshToken: 'invalid-refresh-token',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the session matching the refresh token', async () => {
      const refreshToken = 'test-refresh-token';

      mockPrisma.session.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.logout(testUser.id, {
        refreshToken,
      });

      expect(result.message).toBe('Logout successful');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          refreshTokenHash: hashRefreshToken(refreshToken),
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should reject logout when no active session matches', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.logout(testUser.id, {
          refreshToken: 'invalid-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logoutAll', () => {
    it('should revoke all active sessions belonging to the user', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.logoutAll(testUser.id);

      expect(result).toEqual({
        message: 'Logged out from all devices successfully',
        revokedSessions: 3,
      });

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions and identify the current session', async () => {
      const now = new Date();

      mockPrisma.session.findMany.mockResolvedValue([
        {
          id: 'session-1',
          createdAt: now,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + 86400000),
        },
        {
          id: 'session-2',
          createdAt: now,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + 86400000),
        },
      ]);

      const result = await service.getActiveSessions(testUser.id, 'session-1');

      expect(result.sessions).toHaveLength(2);

      expect(result.sessions[0].isCurrentSession).toBe(true);
      expect(result.sessions[1].isCurrentSession).toBe(false);

      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke an authorized active session', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.revokeSession(testUser.id, 'session-123');

      expect(result.message).toBe('Session revoked successfully');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'session-123',
          userId: testUser.id,
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should reject revocation when the session is not authorized', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.revokeSession(testUser.id, 'other-user-session'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: 'other-user-session',
          userId: testUser.id,
        }),
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return the authenticated user without the password hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        createdAt: testUser.createdAt,
      });

      const result = await service.getCurrentUser(testUser.id);

      expect(result.email).toBe(testUser.email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: testUser.id,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });
    });

    it('should reject requests for a missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
