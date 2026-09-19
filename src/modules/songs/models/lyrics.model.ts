import { z } from 'zod'

export const SyncedLyricsLineModel = z.object({
  startTime: z.number(),
  text: z.string()
})

export const SyncedLyricsModel = z.object({
  id: z.number(),
  name: z.string(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().nullable(),
  duration: z.number().nullable(),
  instrumental: z.boolean(),
  plainLyrics: z.string().nullable(),
  syncedLyrics: z.string().nullable(),
  lines: z.array(SyncedLyricsLineModel)
})

export const SyncedLyricsAPIResponseModel = z.object({
  id: z.number(),
  name: z.string(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().nullable(),
  duration: z.number().nullable(),
  instrumental: z.boolean(),
  plainLyrics: z.string().nullable(),
  syncedLyrics: z.string().nullable()
})
