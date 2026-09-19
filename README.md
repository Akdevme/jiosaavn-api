# JioSaavn API - Serverless Edition

An unofficial JioSaavn API wrapper built with TypeScript and Hono, structured for serverless deployment on Vercel, Netlify, and Cloudflare.

## Features

- 🎵 Search songs, albums, artists, and playlists
- 🎶 Get song details with multiple quality download links
- 💿 Get album details with track listings
- 👨‍🎤 Get artist information, songs, and albums
- 📋 Get playlist details
- 🔍 Global search across all content types
- ⚡ Serverless architecture for Vercel deployment
- 📖 OpenAPI/Swagger documentation included

## Deployment

### Deploy to Vercel

1. Fork or clone this repository
2. Push to your GitHub repository
3. Import to Vercel
4. Deploy!

That's it! `vercel.json` already rewrites requests to the Vercel serverless handler.

### Deploy to Netlify

1. Fork or clone this repository
2. Push to your GitHub repository
3. Import to Netlify
4. Set build command to `npm run build`
5. Leave the publish directory empty

`netlify.toml` already routes all requests to the Netlify function.

### Deploy to Cloudflare

Cloudflare Pages:

1. Import the repository into Cloudflare Pages
2. Set build command to `npm run build`
3. Set build output directory to `dist`

Cloudflare Workers:

1. Use `worker.ts` as the worker entrypoint
2. Deploy with Wrangler using `wrangler.jsonc`

### Local Development

```bash
# Install dependencies
npm install

# Run the app locally without Vercel
npm run dev
```

This starts the local TypeScript test server at `http://localhost:3001`.

If you want to build a production version first, run:

```bash
npm run build
npm start
```

## API Endpoints

### Songs

- `GET /api/songs?ids=3IoDK8qI,4IoDK8qI` - Get songs by IDs
- `GET /api/songs?link=https://www.jiosaavn.com/song/houdini/OgwhbhtDRwM` - Get song by link
- `GET /api/songs/{id}` - Get song by ID
- `GET /api/songs/{id}/suggestions?limit=10` - Get song suggestions

### Albums

- `GET /api/albums?id=23241654` - Get album by ID
- `GET /api/albums?link=https://www.jiosaavn.com/album/future-nostalgia/ITIyo-GDr7A_` - Get album by link

### Artists

- `GET /api/artists?id=1274170` - Get artist by ID
- `GET /api/artists?link=https://www.jiosaavn.com/artist/dua-lipa-songs/r-OWIKgpX2I_` - Get artist by link
- `GET /api/artists/{id}/songs` - Get artist's songs
- `GET /api/artists/{id}/albums` - Get artist's albums

### Playlists

- `GET /api/playlists?id=82914609` - Get playlist by ID
- `GET /api/playlists?link=https://www.jiosaavn.com/featured/its-indie-english/AMoxtXyKHoU_` - Get playlist by link

### Search

- `GET /api/search?query=Imagine+Dragons` - Global search
- `GET /api/search/songs?query=Believer` - Search songs
- `GET /api/search/albums?query=Evolve` - Search albums
- `GET /api/search/artists?query=Adele` - Search artists
- `GET /api/search/playlists?query=Indie` - Search playlists

### Documentation

- `GET /docs` - Interactive API documentation (Scalar)
- `GET /swagger` - OpenAPI/Swagger JSON spec

## Response Format

All endpoints return JSON in the following format:

```json
{
  "success": true,
  "data": { ... }
}
```

## Tech Stack

- **Runtime**: Serverless functions / edge runtimes
- **Framework**: Hono
- **Language**: TypeScript
- **Validation**: Zod
- **API Documentation**: Scalar (OpenAPI)
- **Deployment**: Vercel, Netlify, Cloudflare

## License

MIT

## Credits

Based on the original [JioSaavn API](https://github.com/akdevuix/jiosaavn-api) by Ak.Dev

## Disclaimer

This is an unofficial API wrapper. Please respect JioSaavn's terms of service.
