# MiniMax Music Generation Demo

A small demo repository showing how to use the [MiniMax Music Generation API](https://platform.minimax.io/docs/api-reference/music-generation) to generate AI music from text prompts and lyrics.

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

### Generate a song from lyrics + prompt

```bash
node generate.js
```

This sends a request with a moody indie folk prompt and lyrics, saves the resulting MP3 to `output/`, and plays it.

### Using the API directly with curl

```bash
curl -X POST https://api.minimax.io/v1/music_generation \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "music-2.6-free",
    "prompt": "Indie folk, melancholic, introspective, longing, solitary walk, coffee shop",
    "lyrics": "[verse]\nStreetlights flicker, the night breeze sighs\nShadows stretch as I walk alone\n[chorus]\nPushing the wooden door, the aroma spreads\nIn a familiar corner, a stranger gazes",
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
| `prompt` | string | Yes* | Music style/mood description (1-2000 chars) |
| `lyrics` | string | Yes* | Song lyrics with structure tags like `[verse]`, `[chorus]` |
| `is_instrumental` | boolean | No | Set `true` for instrumental (no lyrics needed) |
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
├── generate.js          # Main demo script
├── package.json
├── .env.example         # Template for .env
├── output/              # Generated audio files (gitignored)
└── README.md
```

## License

MIT
