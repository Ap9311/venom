/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cryptographic hash-keyed hostname routing utility.
 * Resolves and navigates routes without exposing subdomain literals or route tables in client bundles.
 */

const ROOT_DOMAIN_HASH = 3915231439;
const PORTAL_HOST_HASH = 3962433480;
const ALT_REPORT_SEG_HASH = 996030633;

const HOST_ROUTE_TABLE: ReadonlyArray<{ h: number; c: readonly number[] }> = [
  { h: 353102514, c: [95, 121, 58, 27, 130, 96] },
  { h: 922364747, c: [140, 21, 185, 159, 185, 130, 34, 213, 237, 133, 57, 245, 136] },
  { h: 2265726711, c: [3, 43, 53, 223, 33, 121, 250, 218, 191, 228, 25, 47, 114] },
  { h: 1940465061, c: [5, 206, 91, 161, 7, 179, 6, 111, 46, 198, 223, 90, 101, 146, 22, 200, 180, 24] },
  { h: 1714049345, c: [12, 253, 253, 4, 134, 220, 12, 3, 62, 87, 21, 255, 57, 189, 100, 205, 2, 132] },
  { h: 842171639, c: [207, 79, 55, 142, 207, 239, 0, 176, 230, 160, 167, 248, 167, 217, 27, 216, 233, 36, 171, 185, 114, 0, 166, 128] },
  { h: 3029438844, c: [13, 56, 200, 179, 143, 124, 31, 101, 131, 147, 77, 127, 169, 3, 130, 9, 219, 159, 60, 34, 77, 204, 117, 130] },
  { h: 816410003, c: [146, 32, 89, 173, 141, 89, 152, 54, 141, 101, 226, 128, 251, 190, 241, 247, 50, 32, 37, 220, 30, 38, 167, 213] },
  { h: 3832374351, c: [211, 89, 163, 82, 236, 74, 201, 230, 86, 180, 188, 117] },
  { h: 3272197591, c: [128, 106, 68, 106, 245, 217, 92, 240, 115, 251, 202, 100] },
];

const ROUTE_SUB_TABLE: ReadonlyArray<{ h: number; c: readonly number[] }> = [
  { h: 1459592875, c: [34, 43, 252, 54, 219] },
  { h: 1298873321, c: [163, 192, 169, 20, 136, 202, 84, 161, 168, 174, 96, 233, 108, 84, 145, 188, 189, 238, 93, 94, 234, 16, 67] },
  { h: 130105928, c: [135, 78, 24, 193, 163, 198, 250, 205, 235, 194, 74, 210, 193, 51, 96, 153, 86, 202, 67, 31, 230, 93, 38] },
  { h: 1084063412, c: [81, 44, 122, 158, 64, 165, 88, 0, 193, 255, 198, 126, 33] },
  { h: 328367219, c: [69, 150, 14, 139, 33, 35, 251, 149, 17, 62, 111, 78, 36, 96, 193, 175, 152] },
  { h: 4217888209, c: [19, 182, 58, 50, 131, 100, 69, 17, 37, 79, 75] },
  { h: 3768445629, c: [64, 50, 120, 208, 171] },
];

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function decryptBytes(bytes: readonly number[], key: string): string {
  if (!key) return '';
  let state = fnv1a(key) || 1;
  const chars: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = state >>> 0;
    const mask = (state ^ key.charCodeAt(i % key.length)) & 0xff;
    chars.push(bytes[i] ^ mask);
  }
  return String.fromCharCode(...chars);
}

function extractRootDomain(hostname: string): string | null {
  const host = hostname.toLowerCase().trim().split(':')[0];
  const parts = host.split('.');
  if (parts.length < 2) return null;
  const candidate = parts.slice(-2).join('.');
  return fnv1a(candidate) === ROOT_DOMAIN_HASH ? candidate : null;
}

export function isCustomDomainEnv(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  return extractRootDomain(hostname) !== null;
}

export function resolveEffectivePath(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): string {
  const host = hostname.toLowerCase().trim().split(':')[0];
  const hostHash = fnv1a(host);

  const matched = HOST_ROUTE_TABLE.find((entry) => entry.h === hostHash);
  if (matched) {
    return decryptBytes(matched.c, host) + search;
  }

  if (hostHash === PORTAL_HOST_HASH) {
    const basePrefix = decryptBytes([44, 183, 129, 16, 111, 84], host);
    if (pathname === '/' || pathname === '' || pathname === basePrefix) {
      return basePrefix + search;
    }
    const firstSeg = pathname.split('/')[1] || '';
    if (fnv1a(firstSeg) === ALT_REPORT_SEG_HASH) {
      return decryptBytes(
        [44, 183, 129, 16, 111, 84, 17, 171, 3, 156, 37, 33, 20, 198, 213, 251, 40, 30, 220, 97, 166, 28, 193, 89],
        host
      ) + search;
    }
    return (pathname.startsWith(basePrefix) ? pathname : basePrefix + pathname) + search;
  }

  const normalizedPath = pathname === '' ? '/' : pathname;
  return normalizedPath + search;
}

export function getTargetNavigationUrl(
  targetRoute: string,
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''
): string {
  const rootDomain = extractRootDomain(hostname);
  const cleanRoute = targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute;
  const [path, queryStr] = cleanRoute.split('?');
  const search = queryStr ? '?' + queryStr : '';

  if (rootDomain) {
    if (path === '/' || path === '') {
      return `https://${rootDomain}${search}`;
    }

    const segments = path.split('/').filter(Boolean);
    const candidateKeys =
      segments.length >= 2
        ? [`/${segments[0]}/${segments[1]}`, `/${segments[0]}`]
        : [`/${segments[0] || ''}`];

    for (const candidate of candidateKeys) {
      const routeHash = fnv1a(candidate);
      const entry = ROUTE_SUB_TABLE.find((item) => item.h === routeHash);
      if (entry) {
        const subPrefix = decryptBytes(entry.c, `${candidate}|${rootDomain}`);
        return `https://${subPrefix}.${rootDomain}${search}`;
      }
    }

    return `https://${rootDomain}${path}${search}`;
  }

  return `${path}${search}`;
}

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
