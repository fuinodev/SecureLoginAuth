
import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { registerSchema } from './schemas/register.schema.js';

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
}
