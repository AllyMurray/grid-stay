import { Resource } from 'sst';
import type { HotelSuggestion } from '~/lib/db/services/hotel.server';

const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';
const GEOAPIFY_ATTRIBUTION = 'Hotel data powered by Geoapify. © OpenStreetMap contributors.';
const ACCOMMODATION_CATEGORY_PREFIX = 'accommodation';
const GENERIC_ACCOMMODATION_WORDS = /\b(hotel|hotels|accommodation|spa)\b|&/gi;

interface GeoapifyAutocompleteResult {
  place_id?: string;
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  postcode?: string;
  country?: string;
  lat?: number;
  lon?: number;
  categories?: string[];
  result_type?: string;
}

interface GeoapifyAutocompleteResponse {
  results?: GeoapifyAutocompleteResult[];
}

interface GeoapifyPlacesResponse {
  features?: Array<{
    properties?: GeoapifyAutocompleteResult;
  }>;
}

interface PlaceFallbackSearch {
  name: string;
  location: string;
}

function getGeoapifyApiKey() {
  if (process.env.GEOAPIFY_API_KEY) {
    return process.env.GEOAPIFY_API_KEY;
  }

  try {
    const resources = Resource as unknown as {
      GeoapifyApiKey?: { value?: string };
    };
    return resources.GeoapifyApiKey?.value ?? '';
  } catch {
    return '';
  }
}

function isAccommodation(result: GeoapifyAutocompleteResult) {
  return result.categories?.some((category) => category.startsWith(ACCOMMODATION_CATEGORY_PREFIX));
}

function getHotelName(result: GeoapifyAutocompleteResult) {
  return result.name?.trim() || result.address_line1?.trim() || '';
}

function cleanSearchText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripGenericAccommodationWords(value: string) {
  return cleanSearchText(value.replace(GENERIC_ACCOMMODATION_WORDS, ' '));
}

function addPlaceFallbackSearch(searches: PlaceFallbackSearch[], search: PlaceFallbackSearch) {
  const name = cleanSearchText(search.name);
  const location = cleanSearchText(search.location);

  if (name.length < 2 || location.length < 2) {
    return;
  }

  const key = `${name.toLowerCase()}:${location.toLowerCase()}`;
  if (
    searches.some(
      (existing) => `${existing.name.toLowerCase()}:${existing.location.toLowerCase()}` === key,
    )
  ) {
    return;
  }

  searches.push({ name, location });
}

function getSearchTokens(value: string) {
  return stripGenericAccommodationWords(value)
    .replace(/[^a-z0-9'-]+/gi, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function getPlaceFallbackSearches(query: string) {
  const searches: PlaceFallbackSearch[] = [];
  const [namePart, ...locationParts] = query.split(',');
  const location = cleanSearchText(locationParts.join(','));

  if (namePart && location) {
    addPlaceFallbackSearch(searches, {
      name: stripGenericAccommodationWords(namePart),
      location,
    });
    return searches;
  }

  const tokens = getSearchTokens(query);
  if (tokens.length < 3) {
    return searches;
  }

  if (tokens.length >= 4) {
    addPlaceFallbackSearch(searches, {
      name: tokens[0],
      location: tokens.slice(-2).join(' '),
    });
  }

  if (tokens.length >= 5) {
    addPlaceFallbackSearch(searches, {
      name: tokens.slice(0, 2).join(' '),
      location: tokens.slice(-3).join(' '),
    });
  }

  for (let splitIndex = 1; splitIndex < Math.min(tokens.length, 4); splitIndex += 1) {
    addPlaceFallbackSearch(searches, {
      name: tokens.slice(0, splitIndex).join(' '),
      location: tokens.slice(splitIndex).join(' '),
    });
  }

  return searches.slice(0, 4);
}

function toSuggestion(result: GeoapifyAutocompleteResult): HotelSuggestion {
  return {
    name: getHotelName(result),
    address: result.formatted ?? result.address_line2,
    postcode: result.postcode,
    country: result.country,
    latitude: result.lat,
    longitude: result.lon,
    source: 'geoapify',
    sourcePlaceId: result.place_id,
    attribution: GEOAPIFY_ATTRIBUTION,
  };
}

function buildAutocompleteUrl(input: {
  apiKey: string;
  limit: number;
  query: string;
  type?: string;
}) {
  const url = new URL(GEOAPIFY_AUTOCOMPLETE_URL);
  url.searchParams.set('text', input.query);
  if (input.type) {
    url.searchParams.set('type', input.type);
  }
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(input.limit));
  url.searchParams.set('apiKey', input.apiKey);
  return url;
}

async function fetchAutocompleteResults(input: {
  apiKey: string;
  fetcher: typeof fetch;
  limit: number;
  query: string;
  type?: string;
}) {
  const response = await input.fetcher(buildAutocompleteUrl(input));
  if (!response.ok) {
    throw new Error(`Geoapify hotel search failed with ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyAutocompleteResponse;
  return data.results ?? [];
}

function buildPlacesUrl(input: { apiKey: string; limit: number; name: string; placeId: string }) {
  const url = new URL(GEOAPIFY_PLACES_URL);
  url.searchParams.set('categories', ACCOMMODATION_CATEGORY_PREFIX);
  url.searchParams.set('filter', `place:${input.placeId}`);
  url.searchParams.set('name', input.name);
  url.searchParams.set('limit', String(input.limit));
  url.searchParams.set('apiKey', input.apiKey);
  return url;
}

async function fetchAccommodationInsidePlace(input: {
  apiKey: string;
  fetcher: typeof fetch;
  limit: number;
  name: string;
  placeId: string;
}) {
  const response = await input.fetcher(buildPlacesUrl(input));
  if (!response.ok) {
    throw new Error(`Geoapify hotel search failed with ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyPlacesResponse;
  return (data.features ?? [])
    .map((feature) => feature.properties)
    .filter((result): result is GeoapifyAutocompleteResult => Boolean(result));
}

function dedupeSuggestions(suggestions: HotelSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.sourcePlaceId,
      suggestion.name.toLowerCase(),
      suggestion.postcode?.toLowerCase(),
      suggestion.address?.toLowerCase(),
    ]
      .filter(Boolean)
      .join(':');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function searchAccommodationByPlaceFallback(input: {
  apiKey: string;
  fetcher: typeof fetch;
  limit: number;
  query: string;
}) {
  const fallbacks = getPlaceFallbackSearches(input.query);
  if (fallbacks.length === 0) {
    return [];
  }

  const suggestions: HotelSuggestion[] = [];

  for (const fallback of fallbacks) {
    const places = await fetchAutocompleteResults({
      apiKey: input.apiKey,
      fetcher: input.fetcher,
      limit: 3,
      query: fallback.location,
    });

    for (const place of places.slice(0, 3)) {
      if (!place.place_id) {
        continue;
      }

      const hotels = await fetchAccommodationInsidePlace({
        apiKey: input.apiKey,
        fetcher: input.fetcher,
        limit: input.limit,
        name: fallback.name,
        placeId: place.place_id,
      });
      suggestions.push(
        ...hotels
          .filter((result) => isAccommodation(result) && getHotelName(result))
          .map(toSuggestion),
      );

      if (suggestions.length > 0) {
        return dedupeSuggestions(suggestions).slice(0, input.limit);
      }
    }
  }

  return dedupeSuggestions(suggestions).slice(0, input.limit);
}

export async function searchGeoapifyHotels(
  query: string,
  options: {
    limit?: number;
    fetcher?: typeof fetch;
    apiKey?: string;
  } = {},
): Promise<HotelSuggestion[]> {
  const trimmedQuery = query.trim();
  const apiKey = options.apiKey ?? getGeoapifyApiKey();

  if (trimmedQuery.length < 2 || !apiKey) {
    return [];
  }

  const fetcher = options.fetcher ?? fetch;
  const limit = options.limit ?? 8;
  const results = await fetchAutocompleteResults({
    apiKey,
    fetcher,
    limit,
    query: trimmedQuery,
    type: 'amenity',
  });
  const suggestions = results
    .filter((result) => isAccommodation(result) && getHotelName(result))
    .map(toSuggestion);

  if (suggestions.length > 0) {
    return suggestions;
  }

  const broadResults = await fetchAutocompleteResults({
    apiKey,
    fetcher,
    limit,
    query: trimmedQuery,
  });
  const broadSuggestions = broadResults
    .filter((result) => isAccommodation(result) && getHotelName(result))
    .map(toSuggestion);

  if (broadSuggestions.length > 0) {
    return dedupeSuggestions(broadSuggestions);
  }

  return searchAccommodationByPlaceFallback({
    apiKey,
    fetcher,
    limit,
    query: trimmedQuery,
  });
}
