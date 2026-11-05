
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

    // Refresh token expires after 7 days
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    // Store only the token hash in PostgreSQL
    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
      },
    });

    // Return the original token to the caller
    return refreshToken;
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
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email is already registered',
        );
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
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    // Generate JWT access token
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    // Generate refresh token and save session
    const refreshToken = await this.createRefreshSession(user.id);

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
      throw new UnauthorizedException(
        'User account no longer exists',
      );
    }

    return user;
  }
}
