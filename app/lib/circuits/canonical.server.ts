import { normalizeCircuitLabel, normalizeCircuitText } from '~/lib/circuit-sources/shared.server';

export interface CanonicalCircuit {
  circuitId?: string;
  circuitName: string;
  layout?: string;
  known: boolean;
}

interface CircuitCatalogEntry {
  id: string;
  name: string;
  aliases?: string[];
}

const LAYOUT_NAMES = [
  'Grand Prix',
  'International',
  'National',
  'Coastal',
  'Indy',
  'GP',
  '300',
  '200',
  '100',
] as const;

const CIRCUIT_CATALOG: CircuitCatalogEntry[] = [
  {
    id: 'anglesey',
    name: 'Anglesey',
    aliases: ['Anglesey Circuit', 'Trac Mon'],
  },
  {
    id: 'bedford-autodrome',
    name: 'Bedford Autodrome',
  },
  {
    id: 'brands-hatch',
    name: 'Brands Hatch',
  },
  {
    id: 'cadwell-park',
    name: 'Cadwell Park',
  },
  {
    id: 'castle-combe',
    name: 'Castle Combe',
    aliases: ['Castle Combe Circuit'],
  },
  {
    id: 'croft',
    name: 'Croft',
    aliases: ['Croft Circuit'],
  },
  {
    id: 'donington-park',
    name: 'Donington Park',
    aliases: ['Donington'],
  },
  {
    id: 'knockhill',
    name: 'Knockhill',
    aliases: ['Knockhill Racing Circuit'],
  },
  {
    id: 'lydden-hill',
    name: 'Lydden Hill',
    aliases: ['Lydden Hill Race Circuit'],
  },
  {
    id: 'mallory-park',
    name: 'Mallory Park',
    aliases: ['Mallory Park Circuit'],
  },
  {
    id: 'oulton-park',
    name: 'Oulton Park',
  },
  {
    id: 'silverstone',
    name: 'Silverstone',
    aliases: ['Silverstone Circuit'],
  },
  {
    id: 'snetterton',
    name: 'Snetterton',
    aliases: ['Sntterton'],
  },
  {
    id: 'thruxton',
    name: 'Thruxton',
    aliases: ['Thruxton Circuit'],
  },
];

const CATALOG_BY_KEY = new Map(
  CIRCUIT_CATALOG.flatMap((entry) =>
    [entry.name, ...(entry.aliases ?? [])].map((value) => [toLookupKey(value), entry]),
  ),
);

function toLookupKey(value: string): string {
  return normalizeCircuitText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitCircuitAndLayout(value: string): {
  circuitName: string;
  layout?: string;
} {
  const normalized = normalizeCircuitLabel(value);

  for (const layout of LAYOUT_NAMES) {
    const escapedLayout = layout.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(
      new RegExp(`^(.*?)\\s*(?:[-/(]\\s*)?${escapedLayout}\\)?$`, 'i'),
    );
    if (!match?.[1]?.trim()) {
      continue;
    }

    return {
      circuitName: match[1].trim(),
      layout,
    };
  }

  return {
    circuitName: normalized,
  };
}

export function resolveCanonicalCircuit(circuit: string, layout?: string): CanonicalCircuit {
  const split = splitCircuitAndLayout(circuit);
  const normalizedLayout = normalizeCircuitLabel(layout ?? split.layout ?? '');
  const lookupKey = toLookupKey(split.circuitName);
  const catalogEntry = CATALOG_BY_KEY.get(lookupKey);

  if (catalogEntry) {
    return {
      circuitId: catalogEntry.id,
      circuitName: catalogEntry.name,
      layout: normalizedLayout || undefined,
      known: true,
    };
  }

  return {
    circuitName: split.circuitName,
    layout: normalizedLayout || undefined,
    known: false,
  };
}
