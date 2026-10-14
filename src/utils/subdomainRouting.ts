/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility functions for hostname-aware subdomain routing and cross-subdomain navigation.
 * Designed for Nonum network custom subdomains (*.nonum.online) as well as dev & preview deployments.
 */

export const DOMAIN_BASE = 'nonum.online';

export const SUBDOMAINS = {
  HOME: 'nonum.online',
  LOGIN: 'login.nonum.online',
  ADMIN: 'admin.nonum.online',
  REPORTS: 'admin.reports.nonum.online',
  COMMUNITIES: 'admin.communities.nonum.online',
  COMMUNITY_REPORTS: 'admin.community-reports.nonum.online',
  AUDIT: 'admin.audit.nonum.online',
} as const;

/**
 * Checks if the current environment is running on the production custom domain (*.nonum.online)
 */
export function isCustomDomainEnv(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase().trim().split(':')[0];
  return host === DOMAIN_BASE || host.endsWith('.' + DOMAIN_BASE);
}

/**
 * Resolves the effective route path (e.g., '/admin/report') based on hostname and pathname.
 * On subdomains like admin.reports.nonum.online, pathname is '/' on page load.
 * This function resolves the intended component route while preserving query parameters.
 */
export function resolveEffectivePath(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): string {
  const host = hostname.toLowerCase().trim().split(':')[0];

  // Exact subdomain matches for custom domain deployment
  if (host === 'login.nonum.online') {
    return '/login' + search;
  }

  if (host === 'admin.reports.nonum.online' || host === 'reports.admin.nonum.online') {
    return '/admin/report' + search;
  }

  if (host === 'admin.communities.nonum.online' || host === 'communities.admin.nonum.online') {
    return '/admin/communities' + search;
  }

  if (
    host === 'admin.community-reports.nonum.online' ||
    host === 'admin.report-communities.nonum.online' ||
    host === 'community-reports.admin.nonum.online'
  ) {
    return '/admin/community-reports' + search;
  }

  if (host === 'admin.audit.nonum.online' || host === 'audit.admin.nonum.online') {
    return '/admin/audit' + search;
  }

  if (host === 'admin.nonum.online') {
    if (pathname === '/' || pathname === '' || pathname === '/admin') {
      return '/admin' + search;
    }
    if (pathname.startsWith('/report-communities') || pathname.startsWith('/community-reports')) {
      return '/admin/community-reports' + search;
    }
    if (pathname.startsWith('/report')) {
      return '/admin/report' + search;
    }
    if (pathname.startsWith('/audit')) {
      return '/admin/audit' + search;
    }
    if (pathname.startsWith('/communities')) {
      return '/admin/communities' + search;
    }
    return (pathname.startsWith('/admin') ? pathname : '/admin' + pathname) + search;
  }

  // Non-custom hostnames (localhost, mynonum.vercel.app, AI Studio preview):
  // Fallback to standard pathname-based routing
  const normalizedPath = pathname === '' ? '/' : pathname;
  return normalizedPath + search;
}

/**
 * Returns the target navigation URL.
 * Produces absolute HTTPS URLs for *.nonum.online environments,
 * and relative path strings for dev/preview environments.
 */
export function getTargetNavigationUrl(
  targetRoute: string,
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''
): string {
  const isCustom = isCustomDomainEnv(hostname);
  const cleanRoute = targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute;
  const [path, queryStr] = cleanRoute.split('?');
  const search = queryStr ? '?' + queryStr : '';

  if (isCustom) {
    if (path === '/' || path === '') {
      return `https://${SUBDOMAINS.HOME}${search}`;
    }
    if (path.startsWith('/login')) {
      return `https://${SUBDOMAINS.LOGIN}${search}`;
    }
    if (
      path === '/admin/community-reports' ||
      path === '/admin/report-communities' ||
      path.startsWith('/admin/community-reports') ||
      path.startsWith('/admin/report-communities')
    ) {
      return `https://${SUBDOMAINS.COMMUNITY_REPORTS}${search}`;
    }
    if (path === '/admin/report' || path.startsWith('/admin/report')) {
      return `https://${SUBDOMAINS.REPORTS}${search}`;
    }
    if (path === '/admin/communities' || path.startsWith('/admin/communities')) {
      return `https://${SUBDOMAINS.COMMUNITIES}${search}`;
    }
    if (path === '/admin/audit' || path.startsWith('/admin/audit')) {
      return `https://${SUBDOMAINS.AUDIT}${search}`;
    }
    if (path === '/admin' || path.startsWith('/admin')) {
      return `https://${SUBDOMAINS.ADMIN}${search}`;
    }
    return `https://${SUBDOMAINS.HOME}${path}${search}`;
  }

  // Dev / preview environment fallback
  return `${path}${search}`;
}

/**
 * Performs navigation safely across subdomains or single-page routes.
 */
export function navigateToDomainRoute(
  targetRoute: string,
  setCurrentPath?: (path: string) => void
): void {
  const hostname = window.location.hostname;
  const targetUrl = getTargetNavigationUrl(targetRoute, hostname);

  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    if (window.location.href !== targetUrl) {
      window.location.href = targetUrl;
    }
  } else {
    window.history.pushState({}, '', targetUrl);
    if (setCurrentPath) {
      setCurrentPath(targetUrl);
    } else {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }
}
