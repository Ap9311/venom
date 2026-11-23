/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runtime-resolved assistant portal base segment (never hardcoded in client JS).
 * Populated strictly in-memory for the active tab after server confirmation
 * via POST /api/portal-resolve.
 */
let runtimeAssistantSegment = '';

export function setRuntimeAssistantBaseSegment(segment: string): void {
  runtimeAssistantSegment = segment ? segment.replace(/\/+$/, '') : '';
}

export function getRuntimeAssistantBaseSegment(): string {
  return runtimeAssistantSegment;
}

/**
 * Resolves the effective application route based on subdomain and pathname.
 */
export function resolveEffectivePath(
  hostname: string = window.location.hostname,
  pathname: string = window.location.pathname,
  search: string = window.location.search
): string {
  const host = hostname.toLowerCase();
  const fullPath = `${pathname}${search}`;

  if (host.startsWith('admin.')) {
    if (pathname === '/' || pathname === '') return `/admin${search}`;
    if (pathname.startsWith('/admin')) return fullPath;
    return `/admin${pathname}${search}`;
  }

  if (host.startsWith('communities.')) {
    if (pathname === '/' || pathname === '') return `/communities${search}`;
    if (pathname.startsWith('/communities')) return fullPath;
    return `/communities${pathname}${search}`;
  }

  if (host.startsWith('guidelines.')) {
    if (pathname === '/' || pathname === '') return `/guidelines${search}`;
    if (pathname.startsWith('/guidelines')) return fullPath;
    return `/guidelines${pathname}${search}`;
  }

  if (host.startsWith('policies.')) {
    if (pathname === '/' || pathname === '') return `/policies${search}`;
    if (pathname.startsWith('/policies')) return fullPath;
    return `/policies${pathname}${search}`;
  }

  if (host.startsWith('report.')) {
    if (pathname === '/' || pathname === '') return `/report${search}`;
    if (pathname.startsWith('/report')) return fullPath;
    return `/report${pathname}${search}`;
  }

  return fullPath;
}

/**
 * Navigates cleanly inside the assistant portal while keeping the URL under
 * the server-confirmed assistant path prefix.
 */
export function navigateAssistantRoute(
  subPath: '' | '/report' | '/communities' | '/community-reports' | '/report-communities',
  setCurrentPath?: (path: string) => void
): void {
  const host = window.location.hostname.toLowerCase();
  const isAdminSubdomain = host.startsWith('admin.');
  const baseSeg = runtimeAssistantSegment;

  if (!baseSeg) {
    navigateToDomainRoute('/', setCurrentPath);
    return;
  }

  const browserUrl = isAdminSubdomain
    ? `${baseSeg}${subPath}`
    : `/admin${baseSeg}${subPath}`;

  window.history.pushState({}, '', browserUrl);
  if (setCurrentPath) {
    setCurrentPath(`/admin${baseSeg}${subPath}`);
  } else {
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/**
 * Navigates to a target path, redirecting across subdomains on nonum.online
 * or performing instant SPA history navigation on single-host deployments.
 */
export function navigateToDomainRoute(
  targetPath: string,
  setCurrentPath?: (path: string) => void
): void {
  const host = window.location.hostname.toLowerCase();
  const isCustomDomain = host === 'nonum.online' || host.endsWith('.nonum.online');

  if (isCustomDomain) {
    const [pathOnly, queryStr] = targetPath.split('?');
    const search = queryStr ? `?${queryStr}` : '';

    if (pathOnly.startsWith('/admin')) {
      const subPath = pathOnly.replace(/^\/admin/, '') || '/';
      if (host === 'admin.nonum.online') {
        window.history.pushState({}, '', `${subPath}${search}`);
        if (setCurrentPath) setCurrentPath(targetPath);
        else window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        window.location.href = `https://admin.nonum.online${subPath === '/' ? '' : subPath}${search}`;
      }
      return;
    }

    if (pathOnly.startsWith('/communities')) {
      const subPath = pathOnly.replace(/^\/communities/, '') || '/';
      if (host === 'communities.nonum.online') {
        window.history.pushState({}, '', `${subPath}${search}`);
        if (setCurrentPath) setCurrentPath(targetPath);
        else window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        window.location.href = `https://communities.nonum.online${subPath === '/' ? '' : subPath}${search}`;
      }
      return;
    }

    if (pathOnly.startsWith('/guidelines')) {
      const subPath = pathOnly.replace(/^\/guidelines/, '') || '/';
      if (host === 'guidelines.nonum.online') {
        window.history.pushState({}, '', `${subPath}${search}`);
        if (setCurrentPath) setCurrentPath(targetPath);
        else window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        window.location.href = `https://guidelines.nonum.online${subPath === '/' ? '' : subPath}${search}`;
      }
      return;
    }

    if (pathOnly.startsWith('/policies')) {
      const subPath = pathOnly.replace(/^\/policies/, '') || '/';
      if (host === 'policies.nonum.online') {
        window.history.pushState({}, '', `${subPath}${search}`);
        if (setCurrentPath) setCurrentPath(targetPath);
        else window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        window.location.href = `https://policies.nonum.online${subPath === '/' ? '' : subPath}${search}`;
      }
      return;
    }

    if (pathOnly.startsWith('/report')) {
      const subPath = pathOnly.replace(/^\/report/, '') || '/';
      if (host === 'report.nonum.online') {
        window.history.pushState({}, '', `${subPath}${search}`);
        if (setCurrentPath) setCurrentPath(targetPath);
        else window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        window.location.href = `https://report.nonum.online${subPath === '/' ? '' : subPath}${search}`;
      }
      return;
    }

    if (host !== 'nonum.online') {
      window.location.href = `https://nonum.online${targetPath}`;
      return;
    }
  }

  window.history.pushState({}, '', targetPath);
  if (setCurrentPath) {
    setCurrentPath(targetPath);
  } else {
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
