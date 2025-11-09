'use client';

import { useEffect, useState } from 'react';

interface ClientWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientWrapper({ children, fallback }: ClientWrapperProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // For static export, we want to render the children during SSR
  // and then hydrate on the client side
  if (!hasMounted) {
    return <>{fallback || children}</>;
  }

  return <>{children}</>;
}