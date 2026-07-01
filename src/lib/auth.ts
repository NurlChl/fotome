import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';

class UnverifiedEmailError extends CredentialsSignin {
  code = 'unverified_email';
}

class SuspendedAccountError extends CredentialsSignin {
  code = 'suspended_account';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new CredentialsSignin();
        }

        await connectDB();

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        }).select('+passwordHash');

        if (!user) {
          throw new CredentialsSignin();
        }

        if (user.isBanned) {
          throw new SuspendedAccountError();
        }

        const isValid = await user.comparePassword(credentials.password as string);
        if (!isValid) {
          throw new CredentialsSignin();
        }

        if (!user.isVerified) {
          throw new UnverifiedEmailError();
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          permissions: user.adminPermissions,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await connectDB();

        let existingUser = await User.findOne({
          $or: [
            { 'googleOAuth.googleId': account.providerAccountId },
            { email: user.email },
          ],
        });

        if (!existingUser) {
          if (!user.email) return false;
          existingUser = await User.create({
            email: user.email.toLowerCase(),
            name: user.name || 'User',
            avatar: user.image || undefined,
            role: 'user',
            isVerified: true,
            googleOAuth: {
              googleId: account.providerAccountId,
            },
          });
        } else if (!existingUser.googleOAuth?.googleId) {
          existingUser.googleOAuth = {
            googleId: account.providerAccountId,
          };
          existingUser.isVerified = true;
          await existingUser.save();
        }

        if (existingUser.isBanned) {
          return false;
        }

        user.id = existingUser._id.toString();
        user.role = existingUser.role;
        user.permissions = existingUser.adminPermissions;
      }

      // Log login activity
      try {
        const { headers } = await import('next/headers');
        const headersList = await headers();
        const forwarded = headersList.get('x-forwarded-for');
        const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (headersList.get('x-real-ip') || '127.0.0.1');

        const { logActivity } = await import('@/lib/axiom');
        if (user.id) {
          await logActivity(
            user.id,
            'LOGIN',
            `Logged in via ${account?.provider || 'credentials'}`,
            ipAddress
          );
        }
      } catch (err) {
        console.error('Error logging signIn activity:', err);
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          await connectDB();
          const existingUser = await User.findOne({
            $or: [
              { 'googleOAuth.googleId': account.providerAccountId },
              { email: user.email },
            ],
          });
          if (existingUser) {
            token.id = existingUser._id.toString();
            token.role = existingUser.role;
            token.permissions = existingUser.adminPermissions;
          } else {
            token.id = user.id as string;
            token.role = 'user';
          }
        } else {
          await connectDB();
          const dbUser = await User.findById(user.id);
          if (dbUser) {
            token.id = dbUser._id.toString();
            token.role = dbUser.role;
            token.permissions = dbUser.adminPermissions;
          } else {
            token.id = user.id as string;
            token.role = user.role as string;
            token.permissions = user.permissions;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'photographer' | 'admin' | 'superadmin';
        session.user.permissions = token.permissions as {
          manageUsers: boolean;
          manageEvents: boolean;
          managePayouts: boolean;
          manageLogs: boolean;
          manageTransactions: boolean;
          manageClaims: boolean;
          manageCategories: boolean;
        } | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
