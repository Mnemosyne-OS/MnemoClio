/**
 * MnemoClio's agent actions (doc 149): the manifest's declaration passes the HOST's own check,
 * every declared action has its handler (a declared action without one would be offered to
 * agents and fail), and the year and zoom limits it declares are the timeline's own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentActionsFromManifest } from '../../../infinity-edition/src/main/plugins/cartridgeAgentActions';
import { SPAN_LIMITS, YEAR_LIMITS } from './clioAgent';

const root = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'ui', 'clioAgent.ts'), 'utf8');
const block = source.slice(source.indexOf('// agent-actions:begin'), source.indexOf('// agent-actions:end'));
const handlers = [...block.matchAll(/^ {4}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

function declared() {
  const r = agentActionsFromManifest(manifest);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('MnemoClio\'s agent actions', () => {
  it('pass the host\'s check of the manifest', () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    expect(handlers.length).toBeGreaterThan(5);
    expect([...handlers].sort()).toEqual(declared().map((a) => a.id).sort());
  });

  it('nothing spends credits', () => {
    expect(declared().filter((a) => a.effect === 'spend')).toEqual([]);
  });

  it('the years and the zoom it declares are the timeline\'s own', () => {
    const goTo = declared().find((a) => a.id === 'goTo')!;
    for (const k of ['year', 'from', 'to']) expect(goTo.params[k]).toMatchObject({ minimum: YEAR_LIMITS.min, maximum: YEAR_LIMITS.max });
    expect(goTo.params.span).toMatchObject({ minimum: SPAN_LIMITS.min, maximum: SPAN_LIMITS.max });
  });
});
