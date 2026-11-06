
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

import { registerSchema } from './schemas/register.schema.js';
import { loginSchema } from './schemas/login.schema.js';
import { refreshSchema } from './schemas/refresh.schema.js';

import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './types/authenticated-request.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // REGISTER USER
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

  // LOGIN USER
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown) {
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid login data',
        errors: result.error.flatten(),
      });
    }

    return this.authService.login(result.data);
  }

  // ROTATE REFRESH TOKEN
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

  // LOGOUT USER (ONE SESSION)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const result = refreshSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid logout data',
        errors: result.error.flatten(),
      });
    }

    return this.authService.logout(user.id, result.data);
  }

  // LOGOUT FROM ALL DEVICES
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logoutAll(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.logoutAll(user.id);
  }

  // LIST ACTIVE SESSIONS
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  getActiveSessions(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.getActiveSessions(
      user.id,
      user.sessionId,
    );
  }

  // REVOKE A SELECTED SESSION
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe())
    sessionId: string,
  ) {
    return this.authService.revokeSession(
      user.id,
      sessionId,
    );
  }

  // PROTECTED TEST ENDPOINT
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'You have accessed a protected endpoint!',
      userId: user.id,
    };
  }

  // GET AUTHENTICATED USER
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.getCurrentUser(user.id);
  }
}
