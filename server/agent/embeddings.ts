import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (geminiClient) return geminiClient;
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

/**
 * Normalizes error messages by masking dynamic tokens (UUIDs, timestamps, IPs, query hashes, IDs).
 */
export function normalizeErrorMessage(text: string): { normalized: string; hash: string } {
  if (!text) return { normalized: '', hash: 'empty' };

  let clean = text
    // Replace hex UUIDs and Mongo ObjectIds
    .replace(/[0-9a-fA-F]{24,36}/g, '<UUID>')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<UUID>')
    // Replace IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, '<IP>')
    // Replace ISO Timestamps & dates
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TIMESTAMP>')
    // Replace numeric ID patterns e.g. id=123456 or [req_id=...]
    .replace(/\[req_id=[^\]]+\]/gi, '')
    .replace(/\[intent_id=[^\]]+\]/gi, '')
    .replace(/\[session_[^\]]+\]/gi, '')
    .replace(/id=\d+/gi, 'id=<ID>')
    .replace(/PID \d+/gi, 'PID <PID>')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const hash = crypto.createHash('md5').update(clean).digest('hex');
  return { normalized: clean, hash };
}

/**
 * High-dimensional semantic token frequency & lexical-semantic embedding vector.
 * Yields robust semantic vectors even in air-gapped test modes and complements Gemini embeddings.
 */
function computeDeterministicVector(text: string, dimensions = 64): number[] {
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().match(/\b[a-z0-9_]{2,}\b/g) || [];
  
  // Semantic domain keyword weights
  const domainWeights: Record<string, number> = {
    timeout: 3.5,
    timed: 3.0,
    out: 2.0,
    database: 4.0,
    postgres: 4.5,
    pool: 4.0,
    connection: 4.2,
    knex: 3.8,
    sequelize: 3.8,
    stripe: 4.5,
    gateway: 3.5,
    redis: 4.5,
    oom: 4.5,
    memory: 3.8,
    eviction: 4.0,
    auth: 4.0,
    jwt: 4.5,
    token: 3.5,
    rate: 3.5,
    limit: 3.5,
    socket: 3.2,
    econnrefused: 4.5,
    etimedout: 4.5,
    504: 3.8,
    500: 3.0,
    502: 3.5,
    503: 3.5,
    unhandledrejection: 3.0,
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = domainWeights[word] || 1.0;
    
    // Hash word into buckets
    const hash = crypto.createHash('md5').update(word).digest();
    const idx1 = (hash[0] + hash[1]) % dimensions;
    const idx2 = (hash[2] + hash[3]) % dimensions;
    const sign1 = hash[4] % 2 === 0 ? 1 : -1;
    const sign2 = hash[5] % 2 === 0 ? 1 : -1;

    vector[idx1] += sign1 * weight * 1.5;
    vector[idx2] += sign2 * weight * 0.8;

    // N-gram pairs for contextual capture
    if (i < words.length - 1) {
      const pair = `${word}_${words[i + 1]}`;
      const pairHash = crypto.createHash('md5').update(pair).digest();
      const pIdx = (pairHash[0] + pairHash[1]) % dimensions;
      vector[pIdx] += (pairHash[2] % 2 === 0 ? 1 : -1) * 2.0;
    }
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] ** 2;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

/**
 * Returns a vector embedding for the message using Gemini API if available,
 * with deterministic lexical-semantic fallback.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const { normalized } = normalizeErrorMessage(text);
  const client = getGeminiClient();

  if (client) {
    try {
      // Try Gemini embedding model
      const result = await client.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: normalized,
      });

      const embeddingValues = (result as any).embedding?.values || (result as any).embeddings?.[0]?.values;
      if (embeddingValues && embeddingValues.length > 0) {
        return embeddingValues;
      }
    } catch (err) {
      // Fallback silently if API rate limit or key is missing
      // console.warn('Gemini embedContent fallback:', err);
    }
  }

  return computeDeterministicVector(normalized);
}

/**
 * Computes standard Cosine Similarity between two numerical vectors.
 */
export function cosineSimilarity(vecA: number[] = [], vecB: number[] = []): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  
  const minLen = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < minLen; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  const score = dot / denominator;
  return Math.max(0, Math.min(1, score));
}

/**
 * Computes contextual similarity boost based on service topology and time proximity.
 */
export function computeContextualSimilarity(
  baseSimilarity: number,
  serviceA: string,
  servicesInIncident: string[],
  timeDiffSeconds: number
): { finalScore: number; boostDetails: string } {
  let score = baseSimilarity;
  const boosts: string[] = [];

  // Temporal proximity: alerts occurring within 45s of active incident receive high correlation boost
  if (timeDiffSeconds < 15) {
    score += 0.06;
    boosts.push('+6% (immediate 15s cascade window)');
  } else if (timeDiffSeconds < 60) {
    score += 0.03;
    boosts.push('+3% (60s temporal proximity)');
  }

  // Microservice topology correlation
  const serviceOverlap = servicesInIncident.includes(serviceA);
  if (serviceOverlap) {
    score += 0.04;
    boosts.push('+4% (same service origin)');
  }

  // Service cluster affinity: e.g. checkout & payment & orders often fail together
  const relatedGroup1 = ['checkout-api', 'order-processor', 'inventory-service', 'payment-worker', 'checkout-db'];
  const relatedGroup2 = ['billing-service', 'subscription-manager', 'mobile-checkout', 'stripe-webhook'];
  const relatedGroup3 = ['auth-service', 'session-gateway', 'user-profile-api', 'jwt-verifier'];

  const isInGroup1 = relatedGroup1.includes(serviceA) && servicesInIncident.some((s) => relatedGroup1.includes(s));
  const isInGroup2 = relatedGroup2.includes(serviceA) && servicesInIncident.some((s) => relatedGroup2.includes(s));
  const isInGroup3 = relatedGroup3.includes(serviceA) && servicesInIncident.some((s) => relatedGroup3.includes(s));

  if (isInGroup1 || isInGroup2 || isInGroup3) {
    score += 0.03;
    boosts.push('+3% (service topology affinity)');
  }

  const finalScore = Math.min(0.999, Math.max(0, score));
  return {
    finalScore: Number(finalScore.toFixed(3)),
    boostDetails: boosts.join(', ') || 'No contextual boost',
  };
}
