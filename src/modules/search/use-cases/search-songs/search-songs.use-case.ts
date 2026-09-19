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
import type { SearchSongAPIResponseModel, SearchSongModel } from '#modules/search/models'
import type { SongAPIResponseModel } from '#modules/songs/models'
import type { z } from 'zod'

export interface SearchSongsArgs {
  query: string
  page: number
  limit: number
}

export class SearchSongsUseCase implements IUseCase<SearchSongsArgs, z.infer<typeof SearchSongModel>> {
  constructor() {}

  async execute({ query, limit, page }: SearchSongsArgs): Promise<z.infer<typeof SearchSongModel>> {
    // Deployment/debug marker
    console.log('[SEARCH VERSION] FALLBACK SEARCH v2', {
      query,
      page,
      limit,
      timestamp: new Date().toISOString()
    })

    const { data } = await useFetch<z.infer<typeof SearchSongAPIResponseModel>>({
      endpoint: Endpoints.search.songs,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    const primaryResults = data.results || []

    const primaryPayload = primaryResults
      .map(createSongPayload)
      .slice(0, limit)

    // ------------------------------------------------------------
    // PRIMARY SEARCH FOUND A USEFUL RESULT
    // ------------------------------------------------------------

    if (primaryResults.some((song) => hasUsefulSongSearchResult(query, song))) {
      console.log('[SEARCH] Primary search matched:', query)

      return {
        total: data.total,
        start: data.start,
        results: primaryPayload
      }
    }

    // ------------------------------------------------------------
    // FALLBACK SEARCH
    // ------------------------------------------------------------

    console.log('[SEARCH] Primary search missed:', query)
    console.log('[SEARCH] Starting fallback discovery...')

    try {
      // ----------------------------------------------------------
      // 1. AUTOCOMPLETE / SEARCH ALL
      // ----------------------------------------------------------

      const { data: autocomplete } = await useFetch<{
        songs?: {
          data?: Parameters<typeof getMatchingSongIds>[1]
        }

        albums?: {
          data?: {
            title?: unknown
            description?: unknown
            more_info?: {
              music?: unknown
              song_pids?: unknown
            }
          }[]
        }

        artists?: {
          data?: {
            id?: unknown
            title?: unknown
            type?: unknown
          }[]
        }

        topquery?: {
          data?: {
            id?: unknown
            title?: unknown
            type?: unknown
          }[]
        }
      }>({
        endpoint: Endpoints.search.all,
        params: {
          query
        }
      })

      console.log('[SEARCH] Autocomplete response received')

      // ----------------------------------------------------------
      // 2. DIRECT SONG MATCH
      // ----------------------------------------------------------

      let songIds = getMatchingSongIds(
        query,
        autocomplete.songs?.data || [],
        Math.max(limit, 1) * (page + 1)
      )

      console.log('[SEARCH] Direct song IDs:', songIds)

      // ----------------------------------------------------------
      // 3. ALBUM FALLBACK
      // ----------------------------------------------------------

      if (!songIds.length) {
        songIds = getMatchingAlbumSongIds(
          query,
          autocomplete.albums?.data || [],
          Math.max(limit, 1) * (page + 1)
        )

        console.log('[SEARCH] Album fallback IDs:', songIds)
      }

      // ----------------------------------------------------------
      // 4. ARTIST FALLBACK
      // ----------------------------------------------------------

      if (!songIds.length) {
        const artistIds = getMatchingArtistIds(query, [
          ...(autocomplete.artists?.data || []),
          ...(autocomplete.topquery?.data || [])
        ])

        console.log('[SEARCH] Matching artist IDs:', artistIds)

        const artistSongResponses = await Promise.all(
          artistIds.map(async (artistId) => {
            try {
              const { data: artist } = await useFetch<{
                topSongs?: {
                  songs?: {
                    id?: unknown
                  }[]
                }
              }>({
                endpoint: Endpoints.artists.songs,
                params: {
                  artistId,
                  page: 0,
                  sort_order: 'desc',
                  category: 'popularity'
                }
              })

              return artist.topSongs?.songs || []
            } catch (error) {
              console.error(
                '[SEARCH] Artist song lookup failed:',
                artistId,
                error
              )

              return []
            }
          })
        )

        songIds = artistSongResponses
          .flat()
          .map((song) => song.id)
          .filter((id): id is string => typeof id === 'string')
          .filter(
            (id, index, ids) =>
              ids.indexOf(id) === index
          )
          .slice(
            0,
            Math.min(
              Math.max(limit, 1) * (page + 1),
              10
            )
          )

        console.log('[SEARCH] Artist fallback IDs:', songIds)
      }

      // ----------------------------------------------------------
      // 5. PAGINATION
      // ----------------------------------------------------------

      const fallbackIds = songIds.slice(
        page * limit,
        (page + 1) * limit
      )

      console.log('[SEARCH] Final fallback IDs:', fallbackIds)

      // Nothing discovered
      if (!fallbackIds.length) {
        console.log('[SEARCH] Fallback found no songs:', query)

        return {
          total: songIds.length,
          start: page * limit,
          results: []
        }
      }

      // ----------------------------------------------------------
      // 6. GET FULL SONG DETAILS
      // ----------------------------------------------------------

      const { data: details } = await useFetch<{
        songs?: z.infer<typeof SongAPIResponseModel>[]
      }>({
        endpoint: Endpoints.songs.id,
        params: {
          pids: fallbackIds.join(',')
        }
      })

      console.log(
        '[SEARCH] Song details returned:',
        details.songs?.length || 0
      )

      // ----------------------------------------------------------
      // 7. REMOVE DUPLICATES + CREATE NORMAL PAYLOAD
      // ----------------------------------------------------------

      const fallbackResults = (details.songs || [])
        .filter(
          (song, index, songs) =>
            songs.findIndex(
              (item) => item.id === song.id
            ) === index
        )
        .map(createSongPayload)

      console.log(
        '[SEARCH] Fallback results:',
        fallbackResults.length
      )

      // ----------------------------------------------------------
      // 8. RETURN FALLBACK RESULTS
      // ----------------------------------------------------------

      if (fallbackResults.length) {
        console.log(
          '[SEARCH] FALLBACK SUCCESS:',
          query
        )

        return {
          total: songIds.length,
          start: page * limit,
          results: fallbackResults
        }
      }

      console.log(
        '[SEARCH] Fallback returned no detailed songs:',
        query
      )
    } catch (error) {
      console.error(
        '[SEARCH] Fallback discovery failed:',
        query,
        error
      )

      // Keep the original search response
      // if fallback discovery fails.
    }

    // ------------------------------------------------------------
    // ORIGINAL PRIMARY RESPONSE
    // ------------------------------------------------------------

    console.log(
      '[SEARCH] Returning primary response:',
      query
    )

    return {
      total: data.total,
      start: data.start,
      results: primaryPayload
    }
  }
}