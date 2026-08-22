import { createHash } from 'node:crypto';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const TIMEOUT_MS = 8000;

const cache = new Map();

const pct = (n) => Math.round(n * 100);

/** Compact, factual view of the plan. The model only ever sees numbers computed here. */
function facts(plan, selectedId) {
  const selected = plan.routes.find((r) => r.id === selectedId) ?? plan.routes[0];
  const fastest = plan.routes.reduce((a, b) => (a.duration <= b.duration ? a : b));

  return {
    timeOfDay: plan.night ? 'night' : 'daytime',
    filters: Object.entries(plan.filters)
      .filter(([, on]) => on)
      .map(([name]) => name),
    selected: {
      option: selected.label,
      safetyScore: selected.safety,
      minutes: selected.duration,
      metres: selected.distance,
      extraMinutesVsFastest: selected.duration - fastest.duration,
      extraMetresVsFastest: selected.distance - fastest.distance,
      litPercent: pct(selected.factors.light),
      isolationPercent: pct(selected.factors.isolation),
      crimeExposurePercent: pct(selected.factors.crime),
      cameraCoveragePercent: pct(selected.factors.camera),
      weakestStretches: selected.weakest,
    },
    alternatives: plan.routes
      .filter((r) => r.id !== selected.id)
      .map((r) => ({
        option: r.label,
        safetyScore: r.safety,
        minutes: r.duration,
        metres: r.distance,
        litPercent: pct(r.factors.light),
        isolationPercent: pct(r.factors.isolation),
      })),
    unsafeZonesNearby: plan.zones.length,
  };
}

function walkKm(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function safetyFeel(score) {
  if (score >= 72) return 'pretty safe';
  if (score >= 55) return 'okay — stay aware';
  return 'needs extra care';
}

/** Deterministic wording used when no model key is configured, or the model call fails. */
function template(f) {
  const s = f.selected;
  const lines = [];

  lines.push(`About ${s.minutes} min walk (${walkKm(s.metres)}).`);
  lines.push(`Safety score ${s.safetyScore}/100 — ${safetyFeel(s.safetyScore)}.`);

  if (s.extraMinutesVsFastest > 0) {
    lines.push(`Takes about ${s.extraMinutesVsFastest} extra min than the fastest option.`);
  } else {
    lines.push('This is the fastest of the three.');
  }

  lines.push(`Street lights on about ${s.litPercent}% of the way.`);
  lines.push(`Quiet / empty-feeling streets: about ${s.isolationPercent}%.`);
  lines.push(`Cameras along about ${s.cameraCoveragePercent}% of the way.`);
  lines.push(`Crime risk on this path: ${s.crimeExposurePercent}% (lower is better).`);

  if (s.weakestStretches.length) {
    const worst = s.weakestStretches[0];
    lines.push(`Be careful on ${worst.name} — a short weaker bit (~${worst.length} m).`);
  }

  if (f.timeOfDay === 'night') lines.push('This is a night walk, so lights matter more.');

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You explain a walking route to a normal person in Delhi. They are not an engineer.
Rules:
- Use only the numbers in the JSON. Never invent streets, incidents or news.
- Write 5 to 7 very short bullet lines. One idea per line. Simple everyday English.
- No jargon: do not say modelled, exposure, evidence, priors, percentage of length, isolated as a technical term.
- Do say: walk time, safety score, street lights, quiet streets, cameras, crime risk, be careful on [street name].
- Lower crime % is better. Higher lights and cameras is better.
- No paragraphs. No headings. Each line starts with "- ".`;

async function callModel(f) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 320,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(f) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function explainPlan(plan, selectedId) {
  const f = facts(plan, selectedId);
  const key = createHash('sha1').update(`v2:${JSON.stringify(f)}`).digest('hex');
  if (cache.has(key)) return cache.get(key);

  const ai = await callModel(f);
  const result = ai ? { text: ai, source: 'ai' } : { text: template(f), source: 'rules' };

  cache.set(key, result);
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return result;
}
