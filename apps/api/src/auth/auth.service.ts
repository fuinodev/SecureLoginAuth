import { Injectable } from '@nestjs/common';
import type { RegisterInput } from './schemas/register.schema.js';

@Injectable()
export class AuthService {
  register(input: RegisterInput) {
    return {
      message: 'Registration service is ready',
      email: input.email,
    };
  }
}