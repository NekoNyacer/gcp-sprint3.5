import { describe, expect, it } from 'vitest';
import { createAgentTools, parseAgentContext, type CompanionAgentContext } from './companion-agent-domain.js';
const context = (): CompanionAgentContext => ({ inventory: { lightEnergy: 10, waterDrops: 0, fertilizer: 1 }, phase: 'idle', locationSource: 'demo', options: [
  { id: 'tree:direct', treeId: 'tree', treeName: '小榕樹', place: '公園', care: '需要澆水', distanceMeters: 800, durationSeconds: 600, station: null,
    weather: { source: 'unavailable', condition: 'unknown', temperatureC: null, precipitationMm: null, observedAt: null } },
  { id: 'tree:water', treeId: 'tree', treeName: '小榕樹', place: '公園', care: '需要澆水', distanceMeters: 1000, durationSeconds: 901,
    station: { id: 'water', name: '遊戲補水站', resource: 'water' }, weather: { source: 'unavailable', condition: 'unknown', temperatureC: null, precipitationMm: null, observedAt: null } },
] });
describe('companion advisory tools', () => {
  it('enforces time and water constraints, rejects invented IDs and proposing before lookup', () => {
    const tools = createAgentTools(context());
    expect(tools.execute('proposeWalkingPlan', { optionId: 'tree:water' })).toHaveProperty('error');
    expect(tools.execute('getWalkingOptions', { maxMinutes: 15, needWater: true })).toMatchObject({ options: [] });
    expect(tools.execute('proposeWalkingPlan', { optionId: 'tree:water' })).toHaveProperty('error');
    expect(tools.execute('getWalkingOptions', { maxMinutes: 16, needWater: true })).toMatchObject({ options: [{ id: 'tree:water' }] });
    expect(tools.execute('proposeWalkingPlan', { optionId: 'invented' })).toHaveProperty('error');
    expect(tools.execute('proposeWalkingPlan', { optionId: 'tree:water' })).toMatchObject({ applied: false });
    expect(tools.result().proposal).toEqual({ optionId: 'tree:water' });
    tools.execute('getWalkingOptions', { maxMinutes: 5, needWater: false });
    expect(tools.result().proposal).toBeUndefined();
    expect(tools.execute('redeemReward', {})).toHaveProperty('error');
  });
  it('rejects malformed or unbounded snapshots and strips stale live weather', () => {
    expect(parseAgentContext(undefined)).toBeUndefined();
    expect(parseAgentContext(context())?.options).toHaveLength(2);
    const invalid = context(); invalid.options[0].durationSeconds = NaN;
    expect(() => parseAgentContext(invalid)).toThrow();
    const duplicate = context(); duplicate.options[1].id = duplicate.options[0].id;
    expect(() => parseAgentContext(duplicate)).toThrow();
    const stale = context(); stale.options[0].weather = { source: 'open-meteo', condition: 'rainy', temperatureC: 20, precipitationMm: 1, observedAt: '2020-01-01' };
    expect(parseAgentContext(stale)?.options[0].weather.source).toBe('unavailable');
  });

  it('requires the read/lookup/proposal sequence and asks for missing time without a proposal', () => {
    const tools = createAgentTools(context());
    expect(tools.nextTool()).toBe('getPlayerContext');
    tools.execute('getPlayerContext', {});
    expect(tools.nextTool()).toBe('getWalkingOptions');
    expect(tools.execute('getWalkingOptions', { maxMinutes: null, needWater: false })).toHaveProperty('needsClarification', true);
    expect(tools.nextTool()).toBeUndefined();
    expect(tools.result().proposal).toBeUndefined();
  });
});
