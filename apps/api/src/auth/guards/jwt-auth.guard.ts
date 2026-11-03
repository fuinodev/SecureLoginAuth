import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Missing access token');
    }

    const [type, token, extra] = authorization.split(' ');

    if (type !== 'Bearer' || !token || extra) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      request.user = {
        id: payload.sub,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
