import { refreshCircuitDistanceMatrix } from '../app/lib/db/services/circuit-distance-matrix.server';

export async function handler() {
  const matrix = await refreshCircuitDistanceMatrix();

  console.log(
    JSON.stringify({
      message: 'Circuit distance matrix refreshed',
      provider: matrix.provider,
      profile: matrix.profile,
      circuitCount: matrix.circuitIds.length,
      updatedAt: matrix.updatedAt,
    }),
  );

  return {
    provider: matrix.provider,
    profile: matrix.profile,
    circuitCount: matrix.circuitIds.length,
    updatedAt: matrix.updatedAt,
  };
}
