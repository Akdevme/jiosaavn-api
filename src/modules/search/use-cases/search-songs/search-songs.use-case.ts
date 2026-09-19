import { Endpoints } from '#common/constants'
import { useFetch } from '#common/helpers'
import { createSongPayload } from '#modules/songs/helpers'
import {
  getMatchingAlbumSongIds,
  getMatchingArtistIds,
  getMatchingSongIds,
  hasUsefulSongSearchResult
} from '#modules/search/helpers'
import type { IUseCase } from '#common/types'
import type {
  SearchSongAPIResponseModel,
  SearchSongModel
} from '#modules/search/models'
import type { SongAPIResponseModel } from '#modules/songs/models'
import type { z } from 'zod'

export class SearchSongsUseCase
  implements
    IUseCase<
      z.infer<typeof SearchSongModel>,
      z.infer<typeof SearchSongAPIResponseModel>
    >
{
  async execute(
    query: z.infer<typeof SearchSongModel>
  ): Promise<z.infer<typeof SearchSongAPIResponseModel>> {
    const { query: searchQuery, page, limit } = query

    console.log('[SEARCH VERSION] FALLBACK SEARCH v4 DEBUG', {
      query: searchQuery,
      page,
      limit,
      timestamp: new Date().toISOString()
    })

    /*
     * ---------------------------------------------------------
     * 1. PRIMARY SEARCH
     * ---------------------------------------------------------
     */

    const primaryResponse = await useFetch<
      z.infer<typeof SearchSongAPIResponseModel>
    >({
      endpoint: Endpoints.search.songs,
      params: {
        query: searchQuery,
        page,
        limit
      }
    })

    const primaryResults = primaryResponse?.data?.results ?? []

    console.log('[SEARCH] Primary results:', primaryResults.length)

    const primaryHasUsefulResult = primaryResults.some((song) =>
      hasUsefulSongSearchResult(searchQuery, song)
    )

    if (primaryHasUsefulResult) {
      console.log('[SEARCH] Primary search returned useful result')

      return primaryResponse
    }

    console.log('[SEARCH] Primary search missed:', searchQuery)
    console.log('[SEARCH] Starting fallback discovery...')

    /*
     * ---------------------------------------------------------
     * 2. AUTOCOMPLETE FALLBACK
     * ---------------------------------------------------------
     */

    const autocompleteResponse = await useFetch<any>({
      endpoint: Endpoints.search.all,
      params: {
        query: searchQuery
      }
    })

    const autocompleteData = autocompleteResponse?.data ?? {}

    const autocompleteSongs = autocompleteData.songs ?? []
    const autocompleteAlbums = autocompleteData.albums ?? []
    const autocompleteArtists = autocompleteData.artists ?? []
    const autocompleteTopQuery = autocompleteData.topQuery ?? []

    console.log('[SEARCH] Autocomplete response received')

    console.log(
      '[SEARCH] Songs:',
      autocompleteSongs.length
    )

    console.log(
      '[SEARCH] Albums:',
      autocompleteAlbums.length
    )

    console.log(
      '[SEARCH] Artists:',
      autocompleteArtists.length
    )

    console.log(
      '[SEARCH] TopQuery:',
      autocompleteTopQuery.length
    )

    /*
     * ---------------------------------------------------------
     * 3. DEBUG ACTUAL AUTOCOMPLETE DATA
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     * This is temporary debugging.
     *
     * We need to know the exact structure returned by
     * JioSaavn before changing the matcher again.
     */

    console.log(
      '[SEARCH DEBUG] AUTOCOMPLETE SONGS:',
      JSON.stringify(autocompleteSongs, null, 2)
    )

    console.log(
      '[SEARCH DEBUG] AUTOCOMPLETE ALBUMS:',
      JSON.stringify(autocompleteAlbums, null, 2)
    )

    console.log(
      '[SEARCH DEBUG] AUTOCOMPLETE ARTISTS:',
      JSON.stringify(autocompleteArtists, null, 2)
    )

    console.log(
      '[SEARCH DEBUG] AUTOCOMPLETE TOP QUERY:',
      JSON.stringify(autocompleteTopQuery, null, 2)
    )

    /*
     * ---------------------------------------------------------
     * 4. MATCH DIRECT SONGS
     * ---------------------------------------------------------
     */

    const directSongIds = getMatchingSongIds(
      searchQuery,
      autocompleteSongs
    )

    console.log(
      '[SEARCH] Direct song IDs:',
      directSongIds
    )

    /*
     * ---------------------------------------------------------
     * 5. MATCH ALBUMS
     * ---------------------------------------------------------
     */

    const albumFallbackIds = getMatchingAlbumSongIds(
      searchQuery,
      autocompleteAlbums
    )

    console.log(
      '[SEARCH] Album fallback IDs:',
      albumFallbackIds
    )

    /*
     * ---------------------------------------------------------
     * 6. MATCH ARTISTS
     * ---------------------------------------------------------
     */

    const matchingArtistIds = getMatchingArtistIds(
      searchQuery,
      autocompleteArtists
    )

    console.log(
      '[SEARCH] Matching artist IDs:',
      matchingArtistIds
    )

    /*
     * ---------------------------------------------------------
     * 7. GET SONGS FROM ARTISTS
     * ---------------------------------------------------------
     */

    const artistFallbackIds: string[] = []

    for (const artistId of matchingArtistIds) {
      try {
        const artistResponse = await useFetch<any>({
          endpoint: Endpoints.artists.getSongs,
          params: {
            id: artistId,
            page: 0,
            limit: 20
          }
        })

        const artistSongs =
          artistResponse?.data?.results ??
          artistResponse?.data?.songs ??
          []

        console.log(
          '[SEARCH] Artist songs:',
          artistId,
          artistSongs.length
        )

        for (const song of artistSongs) {
          if (
            typeof song?.id === 'string' &&
            hasUsefulSongSearchResult(searchQuery, song)
          ) {
            artistFallbackIds.push(song.id)
          }
        }
      } catch (error) {
        console.log(
          '[SEARCH] Artist fallback failed:',
          artistId,
          error
        )
      }
    }

    console.log(
      '[SEARCH] Artist fallback IDs:',
      artistFallbackIds
    )

    /*
     * ---------------------------------------------------------
     * 8. COMBINE ALL IDS
     * ---------------------------------------------------------
     */

    const finalFallbackIds = [
      ...new Set([
        ...directSongIds,
        ...albumFallbackIds,
        ...artistFallbackIds
      ])
    ]

    console.log(
      '[SEARCH] Final fallback IDs:',
      finalFallbackIds
    )

    /*
     * ---------------------------------------------------------
     * 9. IF NOTHING FOUND
     * ---------------------------------------------------------
     */

    if (finalFallbackIds.length === 0) {
      console.log(
        '[SEARCH] Fallback found no songs:',
        searchQuery
      )

      return {
        success: true,
        data: {
          total: 0,
          start: 0,
          results: []
        }
      }
    }

    /*
     * ---------------------------------------------------------
     * 10. GET FULL SONG DETAILS
     * ---------------------------------------------------------
     */

    const songDetails: SongAPIResponseModel[] = []

    for (const songId of finalFallbackIds) {
      try {
        const response = await useFetch<any>({
          endpoint: Endpoints.songs.getDetails,
          params: {
            id: songId
          }
        })

        const song =
          response?.data?.[0] ??
          response?.data ??
          null

        if (song) {
          songDetails.push(song)
        }
      } catch (error) {
        console.log(
          '[SEARCH] Song details failed:',
          songId,
          error
        )
      }
    }

    console.log(
      '[SEARCH] Song details returned:',
      songDetails.length
    )

    /*
     * ---------------------------------------------------------
     * 11. CREATE NORMAL API PAYLOAD
     * ---------------------------------------------------------
     */

    const fallbackResults = songDetails
      .map((song) => {
        try {
          return createSongPayload(song)
        } catch (error) {
          console.log(
            '[SEARCH] Payload creation failed:',
            song?.id,
            error
          )

          return null
        }
      })
      .filter(Boolean)

    console.log(
      '[SEARCH] Fallback results:',
      fallbackResults.length
    )

    /*
     * ---------------------------------------------------------
     * 12. RETURN FALLBACK RESULTS
     * ---------------------------------------------------------
     */

    if (fallbackResults.length > 0) {
      console.log(
        '[SEARCH] Fallback search SUCCESS:',
        searchQuery
      )

      return {
        success: true,
        data: {
          total: fallbackResults.length,
          start: 0,
          results: fallbackResults
        }
      }
    }

    /*
     * ---------------------------------------------------------
     * 13. FINAL EMPTY RESPONSE
     * ---------------------------------------------------------
     */

    console.log(
      '[SEARCH] Fallback produced no usable results:',
      searchQuery
    )

    return {
      success: true,
      data: {
        total: 0,
        start: 0,
        results: []
      }
    }
  }
}
