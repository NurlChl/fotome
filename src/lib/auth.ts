import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';

export const { handlers, signIn, signOut, auth } = NextAuth({
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
          throw new Error('Email and password are required');
        }

        await connectDB();

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        }).select('+passwordHash');

        if (!user) {
          throw new Error('Invalid email or password');
        }

        if (user.isBanned) {
          throw new Error('Your account has been suspended');
        }

        const isValid = await user.comparePassword(credentials.password as string);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        if (!user.isVerified) {
          throw new Error('Verifikasi email Anda terlebih dahulu. Periksa kotak masuk Anda.');
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
          token.id = user.id as string;
          token.role = user.role as string;
          token.permissions = user.permissions;
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
