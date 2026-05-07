import { describe, expect, it } from 'vite-plus/test';
import { getCircuitLocation, getCircuitLocationForBooking } from './locations';

describe('circuit locations', () => {
  it('includes Spa-Francorchamps for journey planning', () => {
    expect(getCircuitLocation('spa-francorchamps')).toMatchObject({
      circuitId: 'spa-francorchamps',
      name: 'Spa-Francorchamps',
      latitude: 50.43722,
      longitude: 5.97139,
    });
  });

  it('resolves a booking location from the circuit name when the id is missing', () => {
    expect(getCircuitLocationForBooking({ circuit: 'Brands Hatch' })).toMatchObject({
      circuitId: 'brands-hatch',
      latitude: 51.3569,
      longitude: 0.2631,
    });
  });
});
