# MiniMax Music Generation Demo

A demo repository showing how to use the [MiniMax Music Generation API](https://platform.minimax.io/docs/api-reference/music-generation) to generate AI music from text prompts and lyrics.

## Prerequisites

- Node.js 18+
- A MiniMax API key ([get one here](https://platform.minimax.io))

## Setup

```bash
npm install
```

Set your API key:

```bash
export MINIMAX_API_KEY="your-api-key-here"
```

Or create a `.env` file (gitignored):

```bash
MINIMAX_API_KEY=your-api-key-here
```

## Usage

### Option 1: Interactive TUI Wizard (recommended)

```bash
npm run wizard
```

A guided CLI walks you through 9 steps:

1. **Genre** — pick from Indie Folk, Pop, Electronic, Hip-Hop, R&B, Lo-fi, Jazz, Classical, and more
2. **Mood** — Melancholic, Uplifting, Energetic, Chill, Romantic, Dark, Nostalgic, Playful
3. **Vocal Style** — Male/Female (low/high), Group/Harmony, or Instrumental
4. **Tempo** — Slow, Mid-Tempo, Upbeat, Fast
5. **Theme** — pre-built themes or custom
6. **Instrumental toggle** — no lyrics option
7. **Custom Lyrics** — write your own or let AI generate
8. **Song Structure** — verse/chorus/bridge patterns
9. **Extra Details** — custom instruments, references, vibe

Then review your song, optionally edit the AI-generated lyrics, and generate.

### Option 2: Direct Generation (quick test)

```bash
node generate.js
```

Uses a built-in indie folk example to demonstrate the API.

### Using the API with curl

```bash
curl -X POST https://api.minimax.io/v1/music_generation \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "music-2.6-free",
    "prompt": "Indie folk, melancholic, introspective, longing, solitary walk, coffee shop",
    "lyrics": "[verse]\nStreetlights flicker, the night breeze sighs\n[chorus]\nPushing the wooden door, the aroma spreads",
    "audio_setting": {
      "sample_rate": 44100,
      "bitrate": 256000,
      "format": "mp3"
    }
  }'
```

## API Reference

### Endpoint

```
POST https://api.minimax.io/v1/music_generation
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | `music-2.6` (paid), `music-2.6-free` (free tier) |
| `prompt` | string | Yes* | Music style/mood description (1–2000 chars) |
| `lyrics` | string | Yes* | Song lyrics with structure tags |
| `is_instrumental` | boolean | No | `true` for instrumental (no lyrics) |
| `output_format` | string | No | `hex` (default) or `url` — url links expire in 24hrs |
| `audio_setting` | object | No | `sample_rate`, `bitrate`, `format` |

*\*See docs for model-specific requirements.*

### Lyrics Structure Tags

Supports: `[Intro]`, `[Verse]`, `[Pre Chorus]`, `[Chorus]`, `[Interlude]`, `[Bridge]`, `[Outro]`, `[Post Chorus]`, `[Transition]`, `[Break]`, `[Hook]`, `[Build Up]`, `[Inst]`, `[Solo]`

### Response

```json
{
  "data": {
    "audio": "hex-encoded audio data",
    "status": 2
  },
  "extra_info": {
    "music_duration": 25364,
    "music_sample_rate": 44100,
    "bitrate": 256000
  },
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

## Project Structure

```
minimax-music-demo/
├── generate.js          # Core API wrapper + demo runner
├── lyric-generator.js    # Interactive TUI wizard
├── package.json
├── .env.example          # Template for .env
├── output/               # Generated MP3 files (gitignored)
└── README.md
```

## License

MIT
