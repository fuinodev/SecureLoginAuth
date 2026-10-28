## THIS IS FOR DOCUMENTATION OF ERROR EXPERCIENCES
1. Issue: POST /api/v1/auth/register returns HTTP 500 Internal "Server Error".

   Reason: The backend compiles successfully and recognizes the route, but something fails while processing the registration request. We don't yet have enough evidence to determine whether the failure involves Argon2, Prisma, PostgreSQL, or another component.

   Solution: Reproduce the request while observing the NestJS server terminal. We will diagnose the exception before changing any code.