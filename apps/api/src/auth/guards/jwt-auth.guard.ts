
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../prisma/prisma.service.js';

import type { AuthenticatedRequest } from '../types/authenticated-request.js';

interface AccessTokenPayload {
  sub?: unknown;
  sid?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Missing access token');
    }

    const [type, token, extra] = authorization.split(' ');

    if (type !== 'Bearer' || !token || extra) {
      throw new UnauthorizedException(
        'Invalid authorization header',
      );
    }

    // STEP 1: Verify JWT signature and expiration
    let payload: AccessTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(
          token,
        );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    // STEP 2: Validate the JWT claims
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.sid !== 'string' ||
      !payload.sid
    ) {
      throw new UnauthorizedException(
        'Invalid access token payload',
      );
    }

    // STEP 3: Find the associated active session
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException(
        'Session expired or revoked',
      );
    }

    // STEP 4: Attach authenticated user to request
    request.user = {
      id: payload.sub,
      sessionId: session.id,
    };

    return true;
  }
}
