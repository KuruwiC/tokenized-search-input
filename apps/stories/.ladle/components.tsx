import type { ReactNode } from 'react';
// Component styles are imported via @layer base in styles.css
import '../styles.css';

export const Provider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};
