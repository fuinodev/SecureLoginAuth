
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

const jwtExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN;

if (!jwtExpiresIn || !/^[1-9]\d*m$/.test(jwtExpiresIn)) {
  throw new Error(
    'JWT_ACCESS_EXPIRES_IN must be a positive number of minutes, such as 15m',
  );
}

const jwtExpiresInSeconds = Number(jwtExpiresIn.slice(0, -1)) * 60;

if (!Number.isSafeInteger(jwtExpiresInSeconds)) {
  throw new Error('JWT expiration duration is too large');
}

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: jwtExpiresInSeconds,
        algorithm: 'HS256',
      },
      verifyOptions: {
        algorithms: ['HS256'],
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
