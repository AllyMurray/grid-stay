import { describe, expect, it } from 'vite-plus/test';
import { resolveCanonicalCircuit } from './canonical.server';

describe('resolveCanonicalCircuit', () => {
  it('separates known circuit names from layouts', () => {
    expect(resolveCanonicalCircuit('Snetterton 300')).toEqual({
      circuitId: 'snetterton',
      circuitName: 'Snetterton',
      layout: '300',
      known: true,
    });
    expect(resolveCanonicalCircuit('Brands Hatch Indy')).toEqual({
      circuitId: 'brands-hatch',
      circuitName: 'Brands Hatch',
      layout: 'Indy',
      known: true,
    });
  });

  it('corrects known source spelling aliases', () => {
    expect(resolveCanonicalCircuit('Sntterton 300')).toEqual({
      circuitId: 'snetterton',
      circuitName: 'Snetterton',
      layout: '300',
      known: true,
    });
    expect(resolveCanonicalCircuit('Circuit de Spa-Francorchamps')).toEqual({
      circuitId: 'spa-francorchamps',
      circuitName: 'Spa-Francorchamps',
      known: true,
    });
    expect(resolveCanonicalCircuit('Spa')).toEqual({
      circuitId: 'spa-francorchamps',
      circuitName: 'Spa-Francorchamps',
      known: true,
    });
  });

  it('prefers an explicit layout over a parsed layout', () => {
    expect(resolveCanonicalCircuit('Donington Park GP', 'National')).toEqual({
      circuitId: 'donington-park',
      circuitName: 'Donington Park',
      layout: 'National',
      known: true,
    });
  });

  it('keeps unknown venues usable without pretending they are canonical', () => {
    expect(resolveCanonicalCircuit('Example Circuit Outer')).toEqual({
      circuitName: 'Example Circuit Outer',
      known: false,
    });
  });
});
