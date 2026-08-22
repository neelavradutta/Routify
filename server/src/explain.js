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

/** Deterministic wording used when no model key is configured, or the model call fails. */
function template(f) {
  const s = f.selected;
  const lines = [];

  lines.push(
    `${s.option} scores ${s.safetyScore}/100 for a ${s.minutes} minute walk of ${s.metres} m at ${f.timeOfDay}.`,
  );

  const delta =
    s.extraMinutesVsFastest > 0
      ? `It costs ${s.extraMinutesVsFastest} minute${s.extraMinutesVsFastest === 1 ? '' : 's'} more than the quickest option`
      : 'It is also the quickest option on offer';
  lines.push(
    `${delta}, and about ${s.litPercent}% of its length is on streets with lighting evidence, with ${s.isolationPercent}% reading as isolated.`,
  );

  lines.push(
    `Camera coverage along the way is ${s.cameraCoveragePercent}% and modelled crime exposure is ${s.crimeExposurePercent}%.`,
  );

  if (s.weakestStretches.length) {
    const worst = s.weakestStretches[0];
    lines.push(`The weakest stretch is ${worst.name} at ${worst.score}/100 over roughly ${worst.length} m; stay alert there.`);
  }

  if (f.alternatives.length) {
    const best = f.alternatives.reduce((a, b) => (a.safetyScore >= b.safetyScore ? a : b));
    lines.push(
      `${best.option} is the closest alternative at ${best.safetyScore}/100 and ${best.minutes} minutes.`,
    );
  }

  if (f.filters.length) lines.push(`Filters applied: ${f.filters.join(', ')}.`);

  return lines.join(' ');
}

const SYSTEM_PROMPT = `You explain why a walking route was scored as safer to a pedestrian in Delhi.
Rules:
- Use only the numbers in the JSON you are given. Never invent incidents, place names, statistics or news.
- 4 to 6 sentences, plain English, calm and practical. No bullet points, no headings, no markdown.
- Compare the chosen option against the alternatives on safety score, minutes and distance.
- Name the specific weak stretches from the data and say what makes them weak (lighting, isolation, crime exposure, camera coverage).
- Say plainly that scores are estimates from OpenStreetMap signals and area-level crime priors, not a guarantee.
- Never blame or describe any person. No alarming or dramatic language.`;

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
  const key = createHash('sha1').update(JSON.stringify(f)).digest('hex');
  if (cache.has(key)) return cache.get(key);

  const ai = await callModel(f);
  const result = ai ? { text: ai, source: 'ai' } : { text: template(f), source: 'rules' };

  cache.set(key, result);
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return result;
}
