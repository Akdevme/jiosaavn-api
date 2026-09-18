import { HTTPException } from 'hono/http-exception'
import { GetSongByIdUseCase } from '#modules/songs/use-cases/get-song-by-id'
import { SyncedLyricsAPIResponseModel, type SyncedLyricsModel } from '#modules/songs/models'
import type { IUseCase } from '#common/types'
import type { z } from 'zod'

export interface GetSyncedLyricsArgs {
  songId: string
}

export class GetSyncedLyricsUseCase implements IUseCase<GetSyncedLyricsArgs, z.infer<typeof SyncedLyricsModel>> {
  private readonly getSongByIdUseCase: GetSongByIdUseCase

  constructor() {
    this.getSongByIdUseCase = new GetSongByIdUseCase()
  }

  async execute({ songId }: GetSyncedLyricsArgs) {
    const [song] = await this.getSongByIdUseCase.execute({ songIds: songId })

    if (!song) throw new HTTPException(404, { message: 'song not found' })

    const artistName = song.artists.primary?.[0]?.name || song.artists.all?.[0]?.name

    if (!artistName) {
      throw new HTTPException(404, { message: 'artist metadata not found for lyrics lookup' })
    }

    const url = new URL('https://lrclib.net/api/get')
    url.searchParams.set('track_name', song.name)
    url.searchParams.set('artist_name', artistName)

    if (song.album.name) url.searchParams.set('album_name', song.album.name)
    if (song.duration) url.searchParams.set('duration', String(song.duration))

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'jiosaavn-api/1.0.0'
      }
    })

    if (response.status === 404) {
      throw new HTTPException(404, { message: 'synced lyrics not found' })
    }

    if (!response.ok) {
      throw new HTTPException(502, { message: 'failed to fetch synced lyrics' })
    }

    const lyrics = SyncedLyricsAPIResponseModel.parse(await response.json())

    if (!lyrics.syncedLyrics && !lyrics.instrumental) {
      throw new HTTPException(404, { message: 'synced lyrics not found' })
    }

    return {
      ...lyrics,
      lines: parseSyncedLyrics(lyrics.syncedLyrics)
    }
  }
}

const parseSyncedLyrics = (syncedLyrics: string | null) => {
  if (!syncedLyrics) return []

  return syncedLyrics
    .split('\n')
    .map((line) => {
      const match = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/)

      if (!match) return null

      const [, minutes, seconds, fraction = '0', text] = match
      const normalizedFraction = fraction.length === 2 ? `${fraction}0` : fraction
      const startTime = Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(normalizedFraction)

      return {
        startTime,
        text: text.trim()
      }
    })
    .filter((line): line is { startTime: number; text: string } => line !== null)
}
