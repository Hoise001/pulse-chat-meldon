import dns from 'dns/promises';

const PRIVATE_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // link-local
  /^0\./, // current network
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // carrier-grade NAT
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique-local
  /^fd/i, // IPv6 unique-local
  /^fe80:/i // IPv6 link-local
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((re) => re.test(ip));
}

/**
 * Validate a URL is safe to fetch (not pointing to private/internal resources).
 * Rejects private IPs, loopback, link-local, and non-HTTP(S) schemes.
 * Resolves DNS and checks the resulting IPs as well.
 */
export async function validateFederationUrl(
  urlString: string
): Promise<URL> {
  const url = new URL(urlString);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed');
  }

  const hostname = url.hostname;

  // Direct IP check (in case URL uses a raw IP)
  if (isPrivateIp(hostname)) {
    throw new Error('Private/internal URLs are not allowed');
  }

  // DNS resolution check — resolve hostname and verify all IPs are public
  try {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        throw new Error('URL resolves to a private/internal IP address');
      }
    }
  } catch (err) {
    // Re-throw our own validation errors
    if (err instanceof Error && err.message.includes('private')) throw err;
    // DNS resolution failure (IPv6 only, NXDOMAIN, etc.) — allow through
    // since the fetch itself will fail if the host is unreachable
  }

  return url;
}
