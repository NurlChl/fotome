'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { ModalProvider } from './ModalProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ModalProvider>{children}</ModalProvider>
    </SessionProvider>
  );
}
