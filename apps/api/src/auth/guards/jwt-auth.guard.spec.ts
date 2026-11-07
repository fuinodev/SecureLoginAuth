
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockJwtService = {
    verifyAsync: vi.fn(),
  };

  const mockPrisma = {
    session: {
      findFirst: vi.fn(),
    },
  };

  const userId = 'user-123';
  const sessionId = 'session-123';
  const validToken = 'valid-access-token';

  function createContext(authorization?: string) {
    const request: {
      headers: { authorization?: string };
      user?: { id: string; sessionId: string };
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
    } as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    vi.resetAllMocks();

    guard = new JwtAuthGuard(
      mockJwtService as unknown as JwtService,
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('Authorization header validation', () => {
    it('should reject a missing Authorization header', async () => {
      const { context } = createContext();

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Missing access token');

      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject an incorrect authorization scheme', async () => {
      const { context } = createContext('Basic abc123');

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid authorization header');

      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject a Bearer header without a token', async () => {
      const { context } = createContext('Bearer');

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an authorization header with extra parts', async () => {
      const { context } = createContext('Bearer token extra');

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid authorization header');
    });
  });

  describe('JWT verification', () => {
    it('should reject an invalid JWT signature', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('invalid signature'),
      );

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid or expired access token');

      expect(mockPrisma.session.findFirst).not.toHaveBeenCalled();
    });

    it('should reject an expired JWT', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('jwt expired'),
      );

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid or expired access token');
    });

    it('should reject a JWT without a user ID', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sid: sessionId,
      });

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid access token payload');

      expect(mockPrisma.session.findFirst).not.toHaveBeenCalled();
    });

    it('should reject a JWT without a session ID', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: userId,
      });

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid access token payload');
    });

    it('should reject JWT claims with invalid types', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 123,
        sid: true,
      });

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Invalid access token payload');
    });
  });

  describe('Database session validation', () => {
    beforeEach(() => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: userId,
        sid: sessionId,
      });
    });

    it('should reject a nonexistent session', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Session expired or revoked');
    });

    it('should reject a revoked session', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        select: {
          id: true,
        },
      });
    });

    it('should reject an expired database session', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow('Session expired or revoked');
    });

    it('should reject a session belonging to another user', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      const { context } = createContext(
        `Bearer ${validToken}`,
      );

      await expect(
        guard.canActivate(context),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.session.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: sessionId,
          userId,
        }),
        select: {
          id: true,
        },
      });
    });

    it('should allow a valid JWT with an active session', async () => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      const { context, request } = createContext(
        `Bearer ${validToken}`,
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        validToken,
      );

      expect(request.user).toEqual({
        id: userId,
        sessionId,
      });
    });
  });
});
