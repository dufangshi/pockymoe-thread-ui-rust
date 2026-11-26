import { describe, expect, it } from 'vitest';
import type { ModelOptionDto } from '@pockymoe/shared';
import {
  adjacentPickerAgent,
  defaultPickerModel,
  formatContextWindow,
  formatModelPrice,
  formatUsdPerMillion,
  matchPricedModel,
  modelFactsFromCatalog,
  modelSearchScore,
  orderPickerAgents,
  searchPickerGroups,
  visiblePickerModels,
} from './modelPickerLogic';

const model = (id: string, displayName = id, extra: Partial<ModelOptionDto> = {}): ModelOptionDto => ({
  id, model: id, displayName, description: '', isDefault: false, hidden: false,
  supportedReasoningEfforts: [], defaultReasoningEffort: null, ...extra,
});

describe('model picker logic', () => {
  it('puts the current agent first and drops repeats', () => {
    const agents = [{ id: 'claude', name: 'Claude' }, { id: 'codex', name: 'Codex' }, { id: 'claude', name: 'Claude again' }];
    expect(orderPickerAgents(agents, 'codex').map((agent) => agent.id)).toEqual(['codex', 'claude']);
    expect(orderPickerAgents(agents, 'gone').map((agent) => agent.id)).toEqual(['claude', 'codex']);
  });

  it('wraps through the rail', () => {
    const agents = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    expect(adjacentPickerAgent(agents, 'c', 1)).toBe('a');
    expect(adjacentPickerAgent(agents, 'a', -1)).toBe('c');
    expect(adjacentPickerAgent([], 'a', 1)).toBe('a');
  });

  it('keeps hidden models out unless current, and picks the default', () => {
    const models = [model('old', 'Old', { hidden: true }), model('sol', 'Sol'), model('luna', 'Luna', { isDefault: true })];
    expect(visiblePickerModels(models).map((m) => m.model)).toEqual(['sol', 'luna']);
    expect(visiblePickerModels(models, 'old').map((m) => m.model)).toEqual(['old', 'sol', 'luna']);
    expect(defaultPickerModel(models)?.model).toBe('luna');
    expect(defaultPickerModel([model('a', 'A', { hidden: true }), model('b')])?.model).toBe('b');
  });

  it('ranks name starts over word starts over anywhere, and needs every word', () => {
    const sol = model('gpt-6.1-sol', '6.1 Sol');
    expect(modelSearchScore('6.1', sol)).toBe(4);
    expect(modelSearchScore('sol', sol)).toBe(3);
    expect(modelSearchScore('ol', sol)).toBe(2);
    expect(modelSearchScore('gpt', sol)).toBe(1);
    expect(modelSearchScore('codex sol', sol, 'Codex')).toBe(1);
    expect(modelSearchScore('sonnet', sol)).toBe(0);
    expect(modelSearchScore('  ', sol)).toBe(1);
  });

  it('searches across agents and drops agents without a match', () => {
    const groups = [
      { agent: { id: 'codex', name: 'Codex' }, models: [model('gpt-5.6-luna', '5.6 Luna'), model('gpt-6.1-sol', '6.1 Sol')] },
      { agent: { id: 'claude', name: 'Claude Agent' }, models: [model('haiku', 'Haiku 5.5'), model('opus', 'Opus 5.5')] },
    ];
    expect(searchPickerGroups(groups, '5.5').map((group) => [group.agent.id, group.models.map((m) => m.model)]))
      .toEqual([['claude', ['haiku', 'opus']]]);
    expect(searchPickerGroups(groups, 'claude').map((group) => group.models.length)).toEqual([2]);
    expect(searchPickerGroups(groups, 'sol')[0]!.models[0]!.model).toBe('gpt-6.1-sol');
  });

  it('formats context windows and prices compactly', () => {
    expect(formatContextWindow(1_050_000)).toBe('1M');
    expect(formatContextWindow(1_500_000)).toBe('1.5M');
    expect(formatContextWindow(272_000)).toBe('272K');
    expect(formatContextWindow(0)).toBeNull();
    expect(formatUsdPerMillion(2)).toBe('$2');
    expect(formatUsdPerMillion(0.2)).toBe('$0.2');
    expect(formatUsdPerMillion(1.25)).toBe('$1.25');
    expect(formatUsdPerMillion(75)).toBe('$75');
    expect(formatModelPrice({ inputUsdPerMillion: 2, outputUsdPerMillion: 10 })).toBe('$2 · $10');
    expect(formatModelPrice({ inputUsdPerMillion: 2 })).toBe('$2 · –');
    expect(formatModelPrice({})).toBeNull();
  });

  it('matches catalog keys like the device cost estimate', () => {
    const models = {
      'gpt-6.1-sol': { aliases: ['6.1 Sol'], contextWindowTokens: 1_050_000, inputUsdPerMillion: 2, outputUsdPerMillion: 10 },
      haiku: { contextWindowTokens: 200_000, inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
      'claude-opus-5-5': { aliases: ['opus 5.5'], inputUsdPerMillion: 4, outputUsdPerMillion: 20 },
      secret: { unpriced: true, inputUsdPerMillion: 1 },
    };
    expect(matchPricedModel(models, 'gpt-6.1-sol')).toBe('gpt-6.1-sol');
    expect(matchPricedModel(models, 'openai/gpt-6.1-sol')).toBe('gpt-6.1-sol');
    expect(matchPricedModel(models, 'GPT 6.1 SOL')).toBe('gpt-6.1-sol');
    expect(matchPricedModel(models, 'Opus 5.5')).toBe('claude-opus-5-5');
    expect(matchPricedModel(models, 'haiku-20261001')).toBe('haiku');
    expect(matchPricedModel(models, 'secret')).toBeUndefined();
    expect(matchPricedModel(models, '')).toBeUndefined();
    expect(modelFactsFromCatalog({ models }, model('default', 'Opus 5.5'))).toEqual({ contextWindow: undefined, inputUsdPerMillion: 4, outputUsdPerMillion: 20 });
    expect(modelFactsFromCatalog({ models }, model('haiku', 'Haiku 5.5'))?.contextWindow).toBe(200_000);
    expect(modelFactsFromCatalog({ models }, model('unknown'))).toBeNull();
    expect(modelFactsFromCatalog(null, model('haiku'))).toBeNull();
  });
});
