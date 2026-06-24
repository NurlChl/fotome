import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      role: 'user' | 'photographer' | 'admin' | 'superadmin';
      permissions?: {
        manageUsers: boolean;
        manageEvents: boolean;
        managePayouts: boolean;
      };
    };
  }

  interface User {
    role?: string;
    permissions?: {
      manageUsers: boolean;
      manageEvents: boolean;
      managePayouts: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    permissions?: {
      manageUsers: boolean;
      manageEvents: boolean;
      managePayouts: boolean;
    };
  }
}
