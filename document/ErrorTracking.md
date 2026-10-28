## ERROR DOCUMENTATION LOG

1. Issue: POST /api/v1/auth/register returns HTTP 500 Internal "Server Error".

Reason

• The backend compiles successfully and recognizes the route, but something fails while processing the registration request.
• We don't yet have enough evidence to determine whether the failure involves Argon2, Prisma, PostgreSQL, or another component.

Solution

• Reproduce the request while observing the NestJS server terminal. We will diagnose the exception before changing any code.

Actual Exception Causing HTTP 500 Error


Issue

• Prisma fails when attempting to insert a new user into PostgreSQL.

Error Details

• Error Type: PrismaClientKnownRequestError
• Code: ECONNREFUSED
• Model Name: User

Failure Location

• File: C:\SecureLoginAuth\apps\api\src\auth\auth.service.ts

2. Argon2id Verification

is_argon2id | hash_length
------------+------------
f           | 97

Issue:
The verification returned f (false).

Reason:
There is a mistake in the verification command I provided. LEFT(password_hash, 9) instead of LEFT(password_hash, 10)

Solution:
LEFT(password_hash, 9) not LEFT(password_hash, 10)




