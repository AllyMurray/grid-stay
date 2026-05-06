import { describe, expect, it } from 'vite-plus/test';
import { getCircuitLocation } from './locations';

describe('circuit locations', () => {
  it('includes Spa-Francorchamps for journey planning', () => {
    expect(getCircuitLocation('spa-francorchamps')).toMatchObject({
      circuitId: 'spa-francorchamps',
      name: 'Spa-Francorchamps',
      latitude: 50.43722,
      longitude: 5.97139,
    });
  });
});
