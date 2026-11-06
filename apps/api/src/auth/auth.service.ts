import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service.js';
import { jwtExpiresInSeconds } from './config/jwt.config.js';

import type { RegisterInput } from './schemas/register.schema.js';
import type { LoginInput } from './schemas/login.schema.js';
import type { RefreshInput } from './schemas/refresh.schema.js';

import {
  generateRefreshToken,
  hashRefreshToken,
} from './utils/refresh-token.util.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // CREATE REFRESH TOKEN SESSION
  private async createRefreshSession(userId: string) {
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
      },
      select: {
        id: true,
      },
    });

    return {
      refreshToken,
      sessionId: session.id,
    };
  }

  // REGISTER USER
  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      return {
        message: 'User registered successfully',
        user,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  // LOGIN USER
  async login(input: LoginInput) {
    const email = input.email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Create the database session first
    const { refreshToken, sessionId } = await this.createRefreshSession(
      user.id,
    );

    // Associate the access token with the session
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sid: sessionId,
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: jwtExpiresInSeconds,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  // ROTATE REFRESH TOKEN
  async refreshAccessToken(input: RefreshInput) {
    const currentTokenHash = hashRefreshToken(input.refreshToken);

    const session = await this.prisma.session.findUnique({
      where: {
        refreshTokenHash: currentTokenHash,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    const now = new Date();

    const rotation = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: currentTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    if (rotation.count !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Preserve the same session ID after token rotation
    const accessToken = await this.jwtService.signAsync({
      sub: session.userId,
      sid: session.id,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: jwtExpiresInSeconds,
    };
  }

  // LOG OUT AND REVOKE ONE REFRESH SESSION
  async logout(userId: string, input: RefreshInput) {
    const refreshTokenHash = hashRefreshToken(input.refreshToken);

    const now = new Date();

    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return {
      message: 'Logout successful',
    };
  }

  // LOG OUT FROM ALL DEVICES
  async logoutAll(userId: string) {
    const now = new Date();

    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return {
      message: 'Logged out from all devices successfully',
      revokedSessions: result.count,
    };
  }

  // LIST ACTIVE USER SESSIONS
  async getActiveSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
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

    return {
      sessions: sessions.map((session) => ({
        ...session,
        isCurrentSession: session.id === currentSessionId,
      })),
    };
  }

  // REVOKE A SELECTED SESSION
  async revokeSession(userId: string, sessionId: string) {
    const now = new Date();

    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Session not found or already revoked');
    }

    return {
      message: 'Session revoked successfully',
    };
  }

  // GET AUTHENTICATED USER
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    return user;
  }
}
