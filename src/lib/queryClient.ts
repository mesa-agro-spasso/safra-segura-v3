import { QueryClient } from '@tanstack/react-query';

// Singleton shared between App.tsx and AuthContext (so signOut/env changes
// can clear cache without depending on React tree).
export const queryClient = new QueryClient();
