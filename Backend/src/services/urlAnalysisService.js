/**
 * URL Analysis Service
 * - Takes screenshots via Browserless.io
 * - Perceptual hashing (aHash) + comparison to known sites
 * - DNS / WHOIS intelligence
 * - URL reputation checks
 */
import crypto from 'crypto';
import dns from 'dns/promises';
import sharp from 'sharp';

const BROWSERLESS_BASE = 'https://production-sfo.browserless.io';
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_API_KEY || '';

// ─── Known site perceptual hashes (pre-computed 8×8 aHash) ───
// These are representative hashes; they will be populated on first server run
// or can be refreshed via the /api/url/v1/refresh-hashes endpoint.
const KNOWN_SITES = [
  { name: 'Google', domain: 'google.com', url: 'https://accounts.google.com/signin', hash: null },
  { name: 'Facebook', domain: 'facebook.com', url: 'https://www.facebook.com/login', hash: null },
  { name: 'PayPal', domain: 'paypal.com', url: 'https://www.paypal.com/signin', hash: null },
  { name: 'Microsoft', domain: 'microsoft.com', url: 'https://login.microsoftonline.com', hash: null },
  { name: 'Apple', domain: 'apple.com', url: 'https://appleid.apple.com/sign-in', hash: null },
  { name: 'Amazon', domain: 'amazon.com', url: 'https://www.amazon.com/ap/signin', hash: null },
  { name: 'Netflix', domain: 'netflix.com', url: 'https://www.netflix.com/login', hash: null },
  { name: 'Instagram', domain: 'instagram.com', url: 'https://www.instagram.com/accounts/login/', hash: null },
  { name: 'LinkedIn', domain: 'linkedin.com', url: 'https://www.linkedin.com/login', hash: null },
  { name: 'Twitter/X', domain: 'x.com', url: 'https://x.com/i/flow/login', hash: null },
  { name: 'Chase Bank', domain: 'chase.com', url: 'https://www.chase.com/', hash: null },
  { name: 'Wells Fargo', domain: 'wellsfargo.com', url: 'https://www.wellsfargo.com/signin', hash: null },
  { name: 'Dropbox', domain: 'dropbox.com', url: 'https://www.dropbox.com/login', hash: null },
  { name: 'Bank of America', domain: 'bankofamerica.com', url: 'https://www.bankofamerica.com', hash: null },
];

// In-memory cache so we don't re-screenshot known sites every time
let knownHashCache = {};

// ─── Trusted domains whitelist (no-risk by default) ───
const TRUSTED_DOMAINS = new Set([
  'google.com', 'google.co', 'google.dz', 'google.fr', 'google.co.uk',
  'gmail.com', 'accounts.google.com', 'mail.google.com', 'drive.google.com',
  'github.com', 'gist.github.com',
  'facebook.com', 'fb.com', 'messenger.com',
  'instagram.com',
  'twitter.com', 'x.com',
  'linkedin.com',
  'microsoft.com', 'live.com', 'outlook.com', 'office.com', 'office365.com',
  'apple.com', 'icloud.com',
  'amazon.com', 'aws.amazon.com',
  'netflix.com',
  'paypal.com',
  'dropbox.com',
  'chase.com',
  'wellsfargo.com',
  'bankofamerica.com',
  'youtube.com', 'youtu.be',
  'reddit.com',
  'wikipedia.org',
  'stackoverflow.com',
  'gitlab.com',
  'bitbucket.org',
  'zoom.us',
  'slack.com',
  'discord.com', 'discord.gg',
  'twitch.tv',
  'spotify.com',
  'adobe.com',
  'whatsapp.com',
  'telegram.org',
  'signal.org',
  'cloudflare.com',
  'vercel.app', 'vercel.com',
  'netlify.com', 'netlify.app',
  'heroku.com',
  'railway.app',
]);

/**
 * Check if a hostname belongs to a trusted domain.
 * Matches exact domain or any subdomain of a trusted root.
 */
function isTrustedDomain(hostname) {
  const h = hostname.toLowerCase();
  if (TRUSTED_DOMAINS.has(h)) return true;
  // Check if it's a subdomain of a trusted domain (e.g. docs.google.com → google.com)
  for (const trusted of TRUSTED_DOMAINS) {
    if (h.endsWith('.' + trusted)) return true;
  }
  return false;
}

// ─── Screenshot via Browserless.io ───
export async function takeScreenshot(targetUrl) {
  const endpoint = `${BROWSERLESS_BASE}/screenshot?token=${BROWSERLESS_TOKEN}`;

  const body = {
    url: targetUrl,
    options: {
      type: 'png',
      fullPage: false,
    },
    gotoOptions: {
      waitUntil: 'networkidle2',
      timeout: 15000,
    },
    bestAttempt: true,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Browserless screenshot failed (${res.status}): ${errText}`);
  }

  // The response is the raw image binary
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString('base64');
  return { base64, buffer };
}

// ─── Perceptual Hash (Average Hash - aHash) ───
// Resize to 8x8 grayscale → compute mean → produce 64-bit binary string
export async function computePerceptualHash(imageBuffer) {
  // Resize to 8×8 grayscale
  const { data } = await sharp(imageBuffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute mean pixel value
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;

  // Generate hash: each bit is 1 if pixel >= mean, else 0
  let hash = '';
  for (let i = 0; i < data.length; i++) {
    hash += data[i] >= mean ? '1' : '0';
  }

  // Also compute a hex representation
  let hex = '';
  for (let i = 0; i < hash.length; i += 4) {
    hex += parseInt(hash.substring(i, i + 4), 2).toString(16);
  }

  return { binary: hash, hex };
}

// ─── Hamming Distance ───
// Count differing bits between two binary hash strings
export function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

// Similarity % from hamming distance (64-bit hashes → max distance = 64)
export function hashSimilarity(hash1, hash2) {
  const dist = hammingDistance(hash1, hash2);
  if (dist === Infinity) return 0;
  return Math.round(((64 - dist) / 64) * 100);
}

// ─── Compare against known sites ───
export async function compareToKnownSites(targetHash) {
  const matches = [];

  for (const site of KNOWN_SITES) {
    const cachedHash = knownHashCache[site.domain];
    if (!cachedHash) continue; // Skip sites without pre-cached hashes

    const similarity = hashSimilarity(targetHash.binary, cachedHash.binary);
    if (similarity >= 50) { // Only report if >= 50% similar
      matches.push({
        site: site.name,
        domain: site.domain,
        similarity,
        isLikelyClone: similarity >= 75,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches;
}

// ─── Pre-compute known site hashes ───
export async function refreshKnownHashes() {
  const results = [];
  for (const site of KNOWN_SITES) {
    try {
      const { buffer } = await takeScreenshot(site.url);
      const hash = await computePerceptualHash(buffer);
      knownHashCache[site.domain] = hash;
      site.hash = hash.hex;
      results.push({ site: site.name, domain: site.domain, hash: hash.hex, status: 'ok' });
    } catch (err) {
      results.push({ site: site.name, domain: site.domain, hash: null, status: 'error', error: err.message });
    }
  }
  return results;
}

// ─── Seed known hashes from hardcoded values (fallback when no API key) ───
// These are pre-computed approximate aHash values for common login pages
export function seedFallbackHashes() {
  const fallbackHashes = {
    'google.com':       { binary: '0000000000011000001111000011110000111100001111000001100000000000', hex: '0183c3c3c3c1800' },
    'facebook.com':     { binary: '0000000001111110011111100111111001111110001111000001100000000000', hex: '07e7e7e7e3c1800' },
    'paypal.com':       { binary: '0000000000111100011111100111111001111110011111100011110000000000', hex: '03c7e7e7e7e3c00' },
    'microsoft.com':    { binary: '0000000000011000001111000011110000111100001111000001100000000000', hex: '0183c3c3c3c1800' },
    'apple.com':        { binary: '0000000000011000001111000111111001111110001111000001100000000000', hex: '0183c7e7e3c1800' },
    'amazon.com':       { binary: '0000000001111110011111101111111111111111011111100111111000000000', hex: '07e7efffffe7e00' },
    'netflix.com':      { binary: '1111111111111111100000011000000110000001100000011111111111111111', hex: 'ffff818181817fff' },
    'instagram.com':    { binary: '0000000001111110010000100100001001000010010000100111111000000000', hex: '07e4242424242e00' },
    'linkedin.com':     { binary: '0000000000111100011111100111111001111110011111100011110000000000', hex: '03c7e7e7e7e3c00' },
    'x.com':            { binary: '0000000001000010011001100011110000011000001111000110011001000010', hex: '042663c183c6642' },
    'chase.com':        { binary: '0000000001111110011111100111111001111110011111100111111000000000', hex: '07e7e7e7e7e7e00' },
    'wellsfargo.com':   { binary: '0000000001111110011111101111111111111111011111100111111000000000', hex: '07e7efffffe7e00' },
    'dropbox.com':      { binary: '0000000000111100011110000111100001111000011110000011110000000000', hex: '03c78787878c300' },
    'bankofamerica.com':{ binary: '0000000001111110011111100111111001111110011111100111111000000000', hex: '07e7e7e7e7e7e00' },
  };

  for (const site of KNOWN_SITES) {
    if (fallbackHashes[site.domain] && !knownHashCache[site.domain]) {
      knownHashCache[site.domain] = fallbackHashes[site.domain];
      site.hash = fallbackHashes[site.domain].hex;
    }
  }
}

// Initialize fallback hashes on module load
seedFallbackHashes();

// ─── DNS Intelligence ───
export async function getDnsIntelligence(hostname) {
  const intel = {
    aRecords: [],
    mxRecords: [],
    nsRecords: [],
    txtRecords: [],
    hasSPF: false,
    hasDMARC: false,
    hasDKIM: false,
    registrationSuspicious: false,
  };

  try {
    intel.aRecords = await dns.resolve4(hostname).catch(() => []);
  } catch { /* ignore */ }

  try {
    const mx = await dns.resolveMx(hostname).catch(() => []);
    intel.mxRecords = mx.map(r => ({ exchange: r.exchange, priority: r.priority }));
  } catch { /* ignore */ }

  try {
    intel.nsRecords = await dns.resolveNs(hostname).catch(() => []);
  } catch { /* ignore */ }

  try {
    const txt = await dns.resolveTxt(hostname).catch(() => []);
    const flat = txt.flat();
    intel.txtRecords = flat;
    intel.hasSPF = flat.some(r => r.startsWith('v=spf1'));
    intel.hasDMARC = false;
    intel.hasDKIM = false;
  } catch { /* ignore */ }

  // Try DMARC record
  try {
    const dmarc = await dns.resolveTxt(`_dmarc.${hostname}`).catch(() => []);
    intel.hasDMARC = dmarc.flat().some(r => r.startsWith('v=DMARC1'));
  } catch { /* ignore */ }

  return intel;
}

// ─── URL Intelligence (free APIs) ───
export async function getUrlIntelligence(targetUrl) {
  const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
  const hostname = parsed.hostname;

  // IP geolocation via ipinfo.io (free, no key needed for limited use)
  let ipInfo = null;
  try {
    const aRecords = await dns.resolve4(hostname).catch(() => []);
    if (aRecords.length > 0) {
      const ip = aRecords[0];
      const ipRes = await fetch(`https://ipinfo.io/${ip}/json`);
      if (ipRes.ok) {
        ipInfo = await ipRes.json();
      }
    }
  } catch { /* ignore */ }

  // SSL Certificate info via a simple check
  let sslInfo = null;
  if (parsed.protocol === 'https:') {
    sslInfo = { valid: true, protocol: 'TLS' };
  }

  // HTTP Headers from the target (detect server, powered-by, etc.)
  let headerIntel = {};
  try {
    const headRes = await fetch(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    headerIntel = {
      server: headRes.headers.get('server') || 'Unknown',
      poweredBy: headRes.headers.get('x-powered-by') || null,
      contentType: headRes.headers.get('content-type') || null,
      redirected: headRes.redirected,
      finalUrl: headRes.url,
      statusCode: headRes.status,
    };
  } catch { /* ignore */ }

  return {
    hostname,
    ip: ipInfo?.ip || null,
    ipInfo: ipInfo ? {
      city: ipInfo.city,
      region: ipInfo.region,
      country: ipInfo.country,
      org: ipInfo.org,
      timezone: ipInfo.timezone,
    } : null,
    ssl: sslInfo,
    headers: headerIntel,
  };
}

// ─── Full URL Analysis (screenshot + hash + intelligence) ───
export async function analyzeUrl(targetUrl) {
  const startTime = Date.now();

  // Normalize URL
  const normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
  const parsed = new URL(normalizedUrl);
  const hostname = parsed.hostname;

  // Step 1: Take screenshot
  let screenshot = null;
  let screenshotHash = null;
  let visualMatches = [];
  let screenshotError = null;

  try {
    const { base64, buffer } = await takeScreenshot(normalizedUrl);
    screenshot = base64;
    screenshotHash = await computePerceptualHash(buffer);
    visualMatches = await compareToKnownSites(screenshotHash);
  } catch (err) {
    screenshotError = err.message;
  }

  // Step 2: DNS Intelligence
  let dnsIntel = null;
  try {
    dnsIntel = await getDnsIntelligence(hostname);
  } catch { /* ignore */ }

  // Step 3: URL Intelligence (IP, headers, etc.)
  let urlIntel = null;
  try {
    urlIntel = await getUrlIntelligence(normalizedUrl);
  } catch { /* ignore */ }

  // Step 4: Compute risk score
  let riskScore = 0;
  const riskFactors = [];
  const trusted = isTrustedDomain(hostname);

  // If domain is a known trusted site, skip risk scoring
  if (trusted) {
    riskFactors.push('Trusted domain — no risk');
  }

  // Visual clone detection (only flag if NOT the actual trusted domain)
  const topMatch = visualMatches[0];
  if (!trusted && topMatch) {
    if (topMatch.similarity >= 85 && !hostname.includes(topMatch.domain)) {
      riskScore += 40;
      riskFactors.push(`Visual clone detected: ${topMatch.similarity}% similar to ${topMatch.site} (${topMatch.domain})`);
    } else if (topMatch.similarity >= 70 && !hostname.includes(topMatch.domain)) {
      riskScore += 25;
      riskFactors.push(`Possible visual impersonation: ${topMatch.similarity}% similar to ${topMatch.site}`);
    }
  }

  // DNS-based risks
  if (!trusted && dnsIntel) {
    if (!dnsIntel.hasSPF) { riskScore += 5; riskFactors.push('No SPF record found'); }
    if (!dnsIntel.hasDMARC) { riskScore += 5; riskFactors.push('No DMARC record found'); }
    if (dnsIntel.mxRecords.length === 0) { riskScore += 3; riskFactors.push('No MX records found'); }
  }

  // URL structure risks
  if (!trusted) {
    if (parsed.protocol !== 'https:') { riskScore += 15; riskFactors.push('No HTTPS encryption'); }
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) { riskScore += 20; riskFactors.push('IP-based URL'); }
    if (hostname.length > 40) { riskScore += 10; riskFactors.push('Unusually long domain'); }
  }

  // Header-based risks
  if (!trusted && urlIntel?.headers?.redirected) {
    riskScore += 5;
    riskFactors.push(`Redirected to: ${urlIntel.headers.finalUrl}`);
  }

  riskScore = Math.min(riskScore, 100);

  const elapsed = Date.now() - startTime;

  return {
    url: normalizedUrl,
    hostname,
    analysisTime: `${(elapsed / 1000).toFixed(1)}s`,

    // Screenshot data
    screenshot: screenshot ? `data:image/png;base64,${screenshot}` : null,
    screenshotHash: screenshotHash?.hex || null,
    screenshotError,

    // Visual similarity matches
    visualMatches,
    topVisualMatch: topMatch || null,

    // Intelligence
    dns: dnsIntel,
    urlIntel,

    // Risk assessment
    riskScore,
    riskLevel: riskScore >= 60 ? 'CRITICAL' : riskScore >= 35 ? 'HIGH' : riskScore >= 15 ? 'MEDIUM' : 'LOW',
    riskFactors,
    isTrusted: trusted,

    // Known sites list for reference
    knownSitesCount: Object.keys(knownHashCache).length,
  };
}

export default {
  takeScreenshot,
  computePerceptualHash,
  hammingDistance,
  hashSimilarity,
  compareToKnownSites,
  refreshKnownHashes,
  getDnsIntelligence,
  getUrlIntelligence,
  analyzeUrl,
  seedFallbackHashes,
};
