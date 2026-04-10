/**
 * MiniMax Music Generation Demo
 * 
 * Demonstrates how to use the MiniMax Music Generation API.
 * Run standalone: node generate.js
 * Or import: import { generateMusic } from './generate.js';
 * 
 * Docs: https://platform.minimax.io/docs/api-reference/music-generation
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// --- Configuration ---
const API_KEY = process.env.MINIMAX_API_KEY;
const API_URL = 'https://api.minimax.io/v1/music_generation';

// --- Default demo song ---
const DEMO_SONG = {
  model: 'music-2.6-free',
  prompt: 'Indie folk, melancholic, introspective, longing, solitary walk, coffee shop',
  lyrics: `[verse]
Streetlights flicker, the night breeze sighs
Shadows stretch as I walk alone
An old coat wraps my silent sorrow
Wandering, longing, where should I go

[pre-chorus]
Memories fade like autumn leaves
Each step echoes on empty streets

[chorus]
Pushing the wooden door, the aroma spreads
In a familiar corner, a stranger gazes
Steam rises soft against the cold
Just another night, just another story untold

[verse]
The barista knows my order by heart
Same seat, same rain, a familiar art
Outside the city hums its quiet tune
Inside I'm just a silhouette under the moon

[bridge]
But tomorrow's light will find me again
Still walking, still dreaming, still chasing the wind

[chorus]
Pushing the wooden door, the aroma spreads
In a familiar corner, a stranger gazes
Steam rises soft against the cold
Just another night, just another story untold

[outro]
Streetlights flicker... the night breeze sighs...`,
  audio_setting: {
    sample_rate: 44100,
    bitrate: 256000,
    format: 'mp3',
  },
};

// --- Helper: decode hex to buffer ---
function hexToBuffer(hex) {
  hex = hex.replace(/\s/g, '');
  return Buffer.from(hex, 'hex');
}

/**
 * Generate music using the MiniMax API.
 * 
 * @param {Object} songConfig - Song configuration overrides
 *   @param {string} [songConfig.model] - Model to use (e.g. 'music-2.6-free')
 *   @param {string} [songConfig.prompt] - Music style/mood description
 *   @param {string} [songConfig.lyrics] - Song lyrics with structure tags
 *   @param {boolean} [songConfig.instrumental] - Whether to generate instrumental
 *   @param {Object} [songConfig.audio_setting] - Audio output settings
 * @returns {Promise<{success: boolean, file?: string, preview_url?: string, response?: Object}>}
 */
export async function generateMusic(songConfig = {}) {
  const song = { ...DEMO_SONG, ...songConfig };

  if (!API_KEY) {
    throw new Error(
      'MINIMAX_API_KEY is not set. Create a .env file with: MINIMAX_API_KEY=your-api-key\n' +
      'Get your API key at: https://platform.minimax.io'
    );
  }

  console.log('🎵 MiniMax Music Generation\n');
  console.log(`Model:   ${song.model}`);
  console.log(`Prompt:  "${song.prompt}"`);
  if (song.lyrics) {
    console.log(`Lyrics:  ${song.lyrics.split('\n').length} lines`);
  }
  console.log();

  console.log('Sending request to API...');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(song),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log('\nResponse received!');
  console.log(`Trace ID: ${data.trace_id}`);
  console.log(`Status:   ${data.base_resp.status_msg}`);

  if (data.extra_info) {
    console.log(`Duration:    ${(data.extra_info.music_duration / 1000).toFixed(1)}s`);
    console.log(`Sample Rate: ${data.extra_info.music_sample_rate} Hz`);
    console.log(`Bitrate:     ${data.extra_info.bitrate / 1000} kbps`);
    console.log(`File Size:   ${(data.extra_info.music_size / 1024).toFixed(1)} KB`);
  }

  if (data.data?.audio) {
    const filename = `song-${Date.now()}.mp3`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const buffer = hexToBuffer(data.data.audio);
    fs.writeFileSync(filepath, buffer);
    console.log(`\n✅ Saved: ${filepath}`);

    try {
      console.log('▶️  Playing...');
      execSync(`open "${filepath}"`, { stdio: 'ignore' });
    } catch {
      console.log('(Open the file manually to listen)');
    }

    return { success: true, file: filepath, response: data };
  } else if (data.data?.audio_url) {
    console.log(`\n🔗 Audio URL (expires in 24h): ${data.data.audio_url}`);
    console.log('Download it before it expires!');
    return { success: true, preview_url: data.data.audio_url, response: data };
  }

  return { success: false, response: data };
}

// --- Run standalone if executed directly ---
const isMain = process.argv[1]?.endsWith('generate.js');
if (isMain) {
  generateMusic()
    .then((result) => {
      if (!result.success) {
        console.log('\n⚠️  Check the response above for details.');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
}
