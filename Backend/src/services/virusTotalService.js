/**
 * VirusTotal File Analysis Service
 * Uses VirusTotal API v3 to scan files for malware, threats, and suspicious behavior
 */
import fetch from 'node-fetch';
import fs from 'fs';
import crypto from 'crypto';
import FormData from 'form-data';

const VT_API_BASE = 'https://www.virustotal.com/api/v3';
const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY || '';

/**
 * Compute SHA-256 hash of a file buffer
 */
export function computeSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute MD5 hash of a file buffer
 */
export function computeMD5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Upload a file to VirusTotal for scanning
 * POST /api/v3/files – accepts multipart/form-data with a `file` field
 * Returns analysis ID for polling
 */
export async function uploadFileToVT(filePath, originalName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  // For files > 32 MB, get a special upload URL first
  let uploadUrl = `${VT_API_BASE}/files`;
  if (fileSize > 32 * 1024 * 1024) {
    const urlRes = await fetch(`${VT_API_BASE}/files/upload_url`, {
      method: 'GET',
      headers: { 'x-apikey': VT_API_KEY },
    });
    if (!urlRes.ok) throw new Error(`Failed to get upload URL: ${urlRes.status}`);
    const urlData = await urlRes.json();
    uploadUrl = urlData.data;
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: originalName });

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-apikey': VT_API_KEY,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`VirusTotal upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  // data.data.id is the analysis ID
  return {
    analysisId: data.data.id,
    sha256: computeSHA256(fileBuffer),
    md5: computeMD5(fileBuffer),
    fileSize,
  };
}

/**
 * Get analysis status/results from VirusTotal
 * GET /api/v3/analyses/{id}
 */
export async function getAnalysisStatus(analysisId) {
  const res = await fetch(`${VT_API_BASE}/analyses/${analysisId}`, {
    method: 'GET',
    headers: {
      'x-apikey': VT_API_KEY,
      'accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`VirusTotal analysis fetch failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const attrs = data.data.attributes;

  return {
    id: data.data.id,
    status: attrs.status, // "queued" | "completed"
    stats: attrs.stats,   // { malicious, suspicious, undetected, harmless, ... }
    results: attrs.results, // per-engine results
    date: attrs.date,
  };
}

/**
 * Get full file report by SHA-256 hash
 * GET /api/v3/files/{id}
 */
export async function getFileReport(sha256) {
  const res = await fetch(`${VT_API_BASE}/files/${sha256}`, {
    method: 'GET',
    headers: {
      'x-apikey': VT_API_KEY,
      'accept': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null; // File not found in VT database
    const errText = await res.text();
    throw new Error(`VirusTotal file report failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return parseFileReport(data.data);
}

/**
 * Poll for analysis completion with timeout
 */
export async function waitForAnalysis(analysisId, maxWaitMs = 120000, pollIntervalMs = 5000) {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await getAnalysisStatus(analysisId);

    if (status.status === 'completed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout – return last known status
  return await getAnalysisStatus(analysisId);
}

/**
 * Full pipeline: upload → poll → get report
 */
export async function scanFile(filePath, originalName) {
  const startTime = Date.now();

  // 1. Compute hashes before upload
  const fileBuffer = fs.readFileSync(filePath);
  const sha256 = computeSHA256(fileBuffer);
  const md5 = computeMD5(fileBuffer);
  const fileSize = fileBuffer.length;

  // 2. Check if file is already known to VT (by hash)
  let report = await getFileReport(sha256);
  let fromCache = false;

  if (report) {
    fromCache = true;
  } else {
    // 3. Upload to VT
    const upload = await uploadFileToVT(filePath, originalName);

    // 4. Poll for completion
    const analysis = await waitForAnalysis(upload.analysisId);

    if (analysis.status === 'completed') {
      // 5. Get full file report
      report = await getFileReport(sha256);
    }

    if (!report) {
      // Build a minimal report from analysis data
      report = {
        sha256,
        md5,
        fileSize,
        fileName: originalName,
        fileType: null,
        detectionStats: analysis.stats || {},
        totalEngines: 0,
        maliciousCount: analysis.stats?.malicious || 0,
        suspiciousCount: analysis.stats?.suspicious || 0,
        harmlessCount: analysis.stats?.harmless || 0,
        undetectedCount: analysis.stats?.undetected || 0,
        detections: extractTopDetections(analysis.results || {}),
        tags: [],
        threat: determineThreat(analysis.stats || {}),
        analysisStatus: analysis.status,
      };
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    ...report,
    sha256,
    md5,
    fileSize,
    fileName: originalName,
    fromCache,
    analysisTime: `${elapsed}s`,
  };
}

/**
 * Parse VT file report into a clean object
 */
function parseFileReport(fileData) {
  const attrs = fileData.attributes;
  const stats = attrs.last_analysis_stats || {};
  const results = attrs.last_analysis_results || {};
  const totalEngines = Object.keys(results).length;

  return {
    sha256: attrs.sha256,
    md5: attrs.md5,
    fileSize: attrs.size,
    fileName: attrs.meaningful_name || attrs.names?.[0] || null,
    fileType: attrs.type_description || attrs.type_tag || null,
    magic: attrs.magic || null,
    detectionStats: stats,
    totalEngines,
    maliciousCount: stats.malicious || 0,
    suspiciousCount: stats.suspicious || 0,
    harmlessCount: stats.harmless || 0,
    undetectedCount: stats.undetected || 0,
    detections: extractTopDetections(results),
    tags: attrs.tags || [],
    threat: determineThreat(stats),
    reputation: attrs.reputation || 0,
    firstSubmission: attrs.first_submission_date
      ? new Date(attrs.first_submission_date * 1000).toISOString()
      : null,
    lastAnalysis: attrs.last_analysis_date
      ? new Date(attrs.last_analysis_date * 1000).toISOString()
      : null,
    analysisStatus: 'completed',
  };
}

/**
 * Extract top engine detections (malicious / suspicious only)
 */
function extractTopDetections(results) {
  return Object.entries(results)
    .filter(([, r]) => r.category === 'malicious' || r.category === 'suspicious')
    .map(([engine, r]) => ({
      engine,
      category: r.category,
      result: r.result || r.category,
    }))
    .slice(0, 20); // Limit to top 20
}

/**
 * Determine overall threat level from detection stats
 */
function determineThreat(stats) {
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const total = malicious + suspicious;

  if (malicious >= 10) return { level: 'CRITICAL', label: 'Malicious', score: Math.min(100, malicious * 3) };
  if (malicious >= 5) return { level: 'HIGH', label: 'Likely Malicious', score: Math.min(95, 50 + malicious * 5) };
  if (malicious >= 1) return { level: 'MEDIUM', label: 'Suspicious', score: Math.min(70, 30 + malicious * 10) };
  if (suspicious >= 3) return { level: 'MEDIUM', label: 'Suspicious', score: 40 };
  if (suspicious >= 1) return { level: 'LOW', label: 'Questionable', score: 20 };
  return { level: 'CLEAN', label: 'Clean', score: 0 };
}
