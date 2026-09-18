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
    const { data } = await useFetch<z.infer<typeof SearchSongAPIResponseModel>>({
      endpoint: Endpoints.search.songs,
      params: {
        q: query,
        p: page,
        n: limit
      }
    })

    const primaryResults = data.results || []
    const primaryPayload = primaryResults.map(createSongPayload).slice(0, limit)

    if (primaryResults.some((song) => hasUsefulSongSearchResult(query, song))) {
      return {
        total: data.total,
        start: data.start,
        results: primaryPayload
      }
    }

    try {
      const { data: autocomplete } = await useFetch<{
        songs?: { data?: Parameters<typeof getMatchingSongIds>[1] }
        albums?: { data?: { title?: unknown; description?: unknown; more_info?: { music?: unknown; song_pids?: unknown } }[] }
        artists?: { data?: { id?: unknown; title?: unknown; type?: unknown }[] }
        topquery?: { data?: { id?: unknown; title?: unknown; type?: unknown }[] }
      }>({
        endpoint: Endpoints.search.all,
        params: { query }
      })

      let songIds = getMatchingSongIds(query, autocomplete.songs?.data || [], Math.max(limit, 1) * (page + 1))

      if (!songIds.length) {
        songIds = getMatchingAlbumSongIds(query, autocomplete.albums?.data || [], Math.max(limit, 1) * (page + 1))
      }

      if (!songIds.length) {
        const artistIds = getMatchingArtistIds(query, [
          ...(autocomplete.artists?.data || []),
          ...(autocomplete.topquery?.data || [])
        ])
        const artistSongResponses = await Promise.all(
          artistIds.map(async (artistId) => {
            const { data: artist } = await useFetch<{
              topSongs?: { songs?: { id?: unknown }[] }
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
          })
        )

        songIds = artistSongResponses
          .flat()
          .map((song) => song.id)
          .filter((id): id is string => typeof id === 'string')
          .filter((id, index, ids) => ids.indexOf(id) === index)
          .slice(0, Math.min(Math.max(limit, 1) * (page + 1), 10))
      }

      const fallbackIds = songIds.slice(page * limit, (page + 1) * limit)

      if (!fallbackIds.length) {
        return {
          total: songIds.length,
          start: page * limit,
          results: []
        }
      }

      const { data: details } = await useFetch<{ songs?: z.infer<typeof SongAPIResponseModel>[] }>({
        endpoint: Endpoints.songs.id,
        params: { pids: fallbackIds.join(',') }
      })

      const fallbackResults = (details.songs || [])
        .filter((song, index, songs) => songs.findIndex((item) => item.id === song.id) === index)
        .map(createSongPayload)

      if (fallbackResults.length) {
        return {
          total: songIds.length,
          start: page * limit,
          results: fallbackResults
        }
      }
    } catch {
      // Preserve the primary response when fallback discovery is unavailable.
    }

    return {
      total: data.total,
      start: data.start,
      results: primaryPayload
    }
  }
}
