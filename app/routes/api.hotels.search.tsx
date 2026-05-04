import { requireUser } from '~/lib/auth/helpers.server';
import {
  type HotelSuggestion,
  searchHotelCatalogue,
} from '~/lib/db/services/hotel.server';
import { searchGeoapifyHotels } from '~/lib/hotels/geoapify.server';
import { HotelSearchQuerySchema } from '~/lib/schemas/hotel';
import type { Route } from './+types/api.hotels.search';

function dedupeSuggestions(suggestions: HotelSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.hotelId,
      suggestion.source,
      suggestion.sourcePlaceId,
      suggestion.name.toLowerCase(),
      suggestion.postcode?.toLowerCase(),
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

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const url = new URL(request.url);
  const parsed = HotelSearchQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
  });

  if (!parsed.success) {
    return Response.json(
      {
        suggestions: [],
        providerAvailable: true,
        providerError: null,
      },
      { headers },
    );
  }

  const localSuggestions = await searchHotelCatalogue(parsed.data.q, 8);
  let providerSuggestions: HotelSuggestion[] = [];
  let providerError: string | null = null;

  try {
    providerSuggestions = await searchGeoapifyHotels(parsed.data.q, {
      limit: 8,
    });
  } catch (error) {
    providerError =
      error instanceof Error
        ? error.message
        : 'Hotel lookup is not available right now.';
  }

  return Response.json(
    {
      suggestions: dedupeSuggestions([
        ...localSuggestions,
        ...providerSuggestions,
      ]).slice(0, 10),
      providerAvailable: providerError === null,
      providerError,
    },
    { headers },
  );
}
