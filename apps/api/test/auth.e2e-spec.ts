import { Test, type TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  const userId = 'user-123';
  const sessionId = 'session-123';

  const validUser = {
    email: 'test@example.com',
    password: 'TestPassword2026!',
  };

  const mockAuthService = {
    register: vi.fn(),
    login: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    getActiveSessions: vi.fn(),
    revokeSession: vi.fn(),
    getCurrentUser: vi.fn(),
  };

  const mockPrismaService = {
    session: {
      findFirst: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.setGlobalPrefix('api/v1');

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = app.get(JwtService);
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  function createAccessToken() {
    return jwtService.sign({
      sub: userId,
      sid: sessionId,
    });
  }

  describe('Registration', () => {
    it('1. should register a valid user', async () => {
      mockAuthService.register.mockResolvedValue({
        message: 'User registered successfully',
        user: {
          id: userId,
          email: validUser.email,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: validUser,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().message).toBe('User registered successfully');

      expect(mockAuthService.register).toHaveBeenCalledWith(validUser);
    });

    it('2. should reject invalid registration data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Invalid registration data');

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('3. should return 409 for a duplicate email', async () => {
      mockAuthService.register.mockRejectedValue(
        new ConflictException('Email is already registered'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: validUser,
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('Login', () => {
    it('4. should log in with valid credentials', async () => {
      mockAuthService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: validUser,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().accessToken).toBe('access-token');
      expect(response.json().refreshToken).toBe('refresh-token');
    });

    it('5. should reject invalid login data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'invalid',
          password: '',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('6. should reject incorrect credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: validUser,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Protected endpoints', () => {
    it('7. should reject a missing access token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/protected',
      });

      expect(response.statusCode).toBe(401);
    });

    it('8. should reject an invalid access token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/protected',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('9. should allow a valid JWT with an active session', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/protected',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: 'You have accessed a protected endpoint!',
        userId,
      });
    });

    it('10. should reject a revoked session', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/protected',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Refresh token endpoint', () => {
    it('11. should refresh tokens with valid input', async () => {
      mockAuthService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().accessToken).toBe('new-access-token');
      expect(response.json().refreshToken).toBe('new-refresh-token');

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith({
        refreshToken: 'valid-refresh-token',
      });
    });

    it('12. should reject an empty refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: '',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Logout endpoint', () => {
    it('13. should allow an authenticated user to log out', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      mockAuthService.logout.mockResolvedValue({
        message: 'Logout successful',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toBe('Logout successful');

      expect(mockAuthService.logout).toHaveBeenCalledWith(userId, {
        refreshToken: 'valid-refresh-token',
      });
    });

    it('14. should reject logout without an access token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });
  });

  describe('Logout all endpoint', () => {
    it('15. should log out from all devices', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      mockAuthService.logoutAll.mockResolvedValue({
        message: 'Logged out from all devices successfully',
        revokedSessions: 3,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().revokedSessions).toBe(3);

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(userId);
    });
  });

  describe('Active sessions endpoint', () => {
    it('16. should return the authenticated user sessions', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      mockAuthService.getActiveSessions.mockResolvedValue({
        sessions: [
          {
            id: sessionId,
            isCurrentSession: true,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().sessions).toHaveLength(1);

      expect(mockAuthService.getActiveSessions).toHaveBeenCalledWith(
        userId,
        sessionId,
      );
    });

    it('17. should reject unauthenticated session listing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
      });

      expect(response.statusCode).toBe(401);
      expect(mockAuthService.getActiveSessions).not.toHaveBeenCalled();
    });
  });

  describe('Revoke session endpoint', () => {
    const targetSessionId = '550e8400-e29b-41d4-a716-446655440000';

    it('18. should revoke an authorized session', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      mockAuthService.revokeSession.mockResolvedValue({
        message: 'Session revoked successfully',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/auth/sessions/${targetSessionId}`,
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toBe('Session revoked successfully');

      expect(mockAuthService.revokeSession).toHaveBeenCalledWith(
        userId,
        targetSessionId,
      );
    });

    it('19. should reject an invalid session UUID', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/not-a-uuid',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockAuthService.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe('Current user endpoint', () => {
    it('20. should return the authenticated user', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: sessionId,
      });

      mockAuthService.getCurrentUser.mockResolvedValue({
        id: userId,
        email: validUser.email,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${createAccessToken()}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().email).toBe(validUser.email);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(userId);
    });

    it('21. should reject unauthenticated user requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      expect(mockAuthService.getCurrentUser).not.toHaveBeenCalled();
    });
  });
});
