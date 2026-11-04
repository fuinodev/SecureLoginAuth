const jwtExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN;

if (!jwtExpiresIn || !/^[1-9]\d*m$/.test(jwtExpiresIn)) {
  throw new Error(
    'JWT_ACCESS_EXPIRES_IN must be a positive number of minutes, such as 15m',
  );
}

export const jwtExpiresInSeconds =
  Number(jwtExpiresIn.slice(0, -1)) * 60;

if (!Number.isSafeInteger(jwtExpiresInSeconds)) {
  throw new Error('JWT expiration duration is too large');
}
