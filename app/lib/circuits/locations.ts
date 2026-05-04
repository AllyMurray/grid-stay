export interface CircuitLocation {
  circuitId: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const CIRCUIT_LOCATIONS: CircuitLocation[] = [
  {
    circuitId: 'anglesey',
    name: 'Anglesey',
    latitude: 53.1915,
    longitude: -4.5001,
  },
  {
    circuitId: 'bedford-autodrome',
    name: 'Bedford Autodrome',
    latitude: 52.2323,
    longitude: -0.4786,
  },
  {
    circuitId: 'brands-hatch',
    name: 'Brands Hatch',
    latitude: 51.3569,
    longitude: 0.2631,
  },
  {
    circuitId: 'cadwell-park',
    name: 'Cadwell Park',
    latitude: 53.3106,
    longitude: -0.0598,
  },
  {
    circuitId: 'castle-combe',
    name: 'Castle Combe',
    latitude: 51.493,
    longitude: -2.2156,
  },
  {
    circuitId: 'croft',
    name: 'Croft',
    latitude: 54.4559,
    longitude: -1.555,
  },
  {
    circuitId: 'donington-park',
    name: 'Donington Park',
    latitude: 52.8306,
    longitude: -1.3751,
  },
  {
    circuitId: 'knockhill',
    name: 'Knockhill',
    latitude: 56.1302,
    longitude: -3.5087,
  },
  {
    circuitId: 'lydden-hill',
    name: 'Lydden Hill',
    latitude: 51.1774,
    longitude: 1.1987,
  },
  {
    circuitId: 'mallory-park',
    name: 'Mallory Park',
    latitude: 52.5984,
    longitude: -1.3371,
  },
  {
    circuitId: 'oulton-park',
    name: 'Oulton Park',
    latitude: 53.179,
    longitude: -2.613,
  },
  {
    circuitId: 'silverstone',
    name: 'Silverstone',
    latitude: 52.0733,
    longitude: -1.0147,
  },
  {
    circuitId: 'snetterton',
    name: 'Snetterton',
    latitude: 52.4632,
    longitude: 0.9456,
  },
  {
    circuitId: 'thruxton',
    name: 'Thruxton',
    latitude: 51.2109,
    longitude: -1.6089,
  },
];

export const CIRCUIT_LOCATIONS_BY_ID = new Map(
  CIRCUIT_LOCATIONS.map((location) => [location.circuitId, location]),
);

export function getCircuitLocation(circuitId?: string) {
  return circuitId ? CIRCUIT_LOCATIONS_BY_ID.get(circuitId) : undefined;
}
