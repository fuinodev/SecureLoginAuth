import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { registerSchema } from './schemas/register.schema.js';
import { loginSchema } from './schemas/login.schema.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './types/authenticated-request.js';
import { refreshSchema } from './schemas/refresh.schema.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: unknown) {
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid registration data',
        errors: result.error.flatten(),
      });
    }

    return this.authService.register(result.data);
  }
  // REFRESH ACCESS TOKEN
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    const result = refreshSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid refresh token data',
        errors: result.error.flatten(),
      });
    }

    return this.authService.refreshAccessToken(result.data);
  }
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'You have accessed a protected endpoint!',
      userId: user.id,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.id);
  }
}
