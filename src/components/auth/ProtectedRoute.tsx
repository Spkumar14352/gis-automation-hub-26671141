interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Auth disabled - allow all access while keeping database functionality
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}
