export function shouldRedirectUnauthenticatedRoute(loading: boolean, isAuthenticated: boolean): boolean {
  return !loading && !isAuthenticated;
}
