import {
  CreateSongStationUseCase,
  GetSongByIdUseCase,
  GetSongByLinkUseCase,
  GetSyncedLyricsUseCase,
  GetSongSuggestionsUseCase,
  type GetSyncedLyricsArgs,
  type GetSongByIdArgs,
  type GetSongSuggestionsArgs
} from '#modules/songs/use-cases'

export class SongService {
  private readonly getSongByIdUseCase: GetSongByIdUseCase
  private readonly getSongByLinkUseCase: GetSongByLinkUseCase
  private readonly createSongStationUseCase: CreateSongStationUseCase
  private readonly getSongSuggestionsUseCase: GetSongSuggestionsUseCase
  private readonly getSyncedLyricsUseCase: GetSyncedLyricsUseCase

  constructor() {
    this.getSongByIdUseCase = new GetSongByIdUseCase()
    this.getSongByLinkUseCase = new GetSongByLinkUseCase()
    this.createSongStationUseCase = new CreateSongStationUseCase()
    this.getSongSuggestionsUseCase = new GetSongSuggestionsUseCase()
    this.getSyncedLyricsUseCase = new GetSyncedLyricsUseCase()
  }

  getSongByIds = (args: GetSongByIdArgs) => {
    return this.getSongByIdUseCase.execute(args)
  }

  getSongByLink = (token: string) => {
    return this.getSongByLinkUseCase.execute(token)
  }

  createSongStation = (songIds: string) => {
    return this.createSongStationUseCase.execute(songIds)
  }

  getSongSuggestions = (args: GetSongSuggestionsArgs) => {
    return this.getSongSuggestionsUseCase.execute(args)
  }

  getSyncedLyrics = (args: GetSyncedLyricsArgs) => {
    return this.getSyncedLyricsUseCase.execute(args)
  }
}
