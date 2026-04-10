/**
 * MiniMax Music Generation - Interactive TUI Lyric & Prompt Generator
 * 
 * A guided CLI that walks you through choosing music style, mood, vocals,
 * and theme, then generates a structured prompt + lyrics for the music API.
 * 
 * Run: node lyric-generator.js
 */

import 'dotenv/config';
import enquirer from 'enquirer';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMusic } from './generate.js';

const { prompt } = enquirer;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── TUI Color helpers (ANSI) ─────────────────────────────────────────────

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const magenta = (s) => `\x1b[35m${s}\x1b[0m`;
const divider = () => console.log(dim('─'.repeat(60)));

// ─── Data sets ─────────────────────────────────────────────────────────────

const GENRES = [
  'Indie Folk',
  'Pop',
  'Electronic / Synth',
  'Hip-Hop / Rap',
  'R&B / Soul',
  'Rock (Acoustic)',
  'Lo-fi / Chill',
  'Jazz / Blues',
  'Classical / Cinematic',
  'World / Folk',
  'Custom...',
];

const MOODS = [
  { name: 'Melancholic / Sad', hint: 'lonely, yearning, rainy night vibes' },
  { name: 'Uplifting / Happy', hint: 'bright, hopeful, celebration' },
  { name: 'Energetic / Pumped', hint: 'driving, powerful, workout' },
  { name: 'Chill / Relaxed', hint: 'mellow, laid-back, coffee shop' },
  { name: 'Romantic / Love', hint: 'tender, intimate, heartfelt' },
  { name: 'Dark / Intense', hint: 'brooding, intense, cinematic' },
  { name: 'Nostalgic / Reflective', hint: 'memories, past, bittersweet' },
  { name: 'Playful / Fun', hint: 'quirky, lighthearted, whimsical' },
];

const VOCAL_STYLES = [
  { name: 'Male (Low)', hint: 'baritone, deep, warm' },
  { name: 'Male (High)', hint: 'tenor, falsetto, breathy' },
  { name: 'Female (Low)', hint: 'alto, rich, soulful' },
  { name: 'Female (High)', hint: 'soprano, ethereal, crystalline' },
  { name: 'Group / Harmony', hint: 'chorus, layered voices' },
  { name: 'Instrumental Only', hint: 'no vocals, pure music' },
];

const TEMPO_PRESETS = [
  { name: 'Slow & Gentle', hint: '60-80 BPM — ballads, introspective' },
  { name: 'Mid-Tempo', hint: '85-110 BPM — relaxed grooves' },
  { name: 'Upbeat', hint: '115-140 BPM — energetic, driving' },
  { name: 'Fast & Intense', hint: '140+ BPM — hype, adrenaline' },
];

const SONG_STRUCTURES = [
  '[Intro] → [Verse] → [Chorus] → [Verse] → [Chorus] → [Bridge] → [Chorus] → [Outro]',
  '[Intro] → [Verse] → [Pre-Chorus] → [Chorus] → [Verse] → [Chorus] → [Outro]',
  '[Intro] → [Verse] → [Chorus] → [Verse] → [Chorus] → [Bridge] → [Chorus] → [Outro] → [Post-Chorus]',
  '[Intro] → [Verse] → [Verse] → [Chorus] → [Chorus] → [Bridge] → [Outro]',
  '[Hook] → [Verse] → [Hook] → [Verse] → [Hook] → [Bridge] → [Hook] → [Outro]',
  'Custom structure...',
];

const THEMES = [
  'Longing for someone far away',
  'Late-night city wandering',
  'Finding hope after heartbreak',
  'Chasing dreams against the odds',
  'The comfort of routine',
  'Saying goodbye to someone dear',
  'Self-discovery and growth',
  'Celebrating small victories',
  'Nature and changing seasons',
  'Custom theme...',
];

// ─── Logo / header ─────────────────────────────────────────────────────────

function showLogo() {
  console.log(`
${magenta('╔══════════════════════════════════════════════════╗')}
${magenta('║')}  ${cyan('🎵')}  ${bold('MiniMax Music — Lyric Wizard')}  ${magenta('║')}
${magenta('╚══════════════════════════════════════════════════╝')}
${dim('Build your song step by step. All choices can be customized.\n')}
`);
}

// ─── Step 1: Genre ──────────────────────────────────────────────────────────

async function askGenre() {
  divider();
  const { genre } = await prompt({
    type: 'select',
    name: 'genre',
    message: `${bold('Step 1 of 9:')} What ${cyan('genre')} of music?\n`,
    choices: GENRES,
    pointer: '❯',
    styles: { primary: cyan },
  });

  if (genre === 'Custom...') {
    const result = await prompt({
      type: 'input',
      name: 'customGenre',
      message: 'Enter your custom genre:',
      validate: (s) => s.trim().length >= 2 || 'Please enter a genre name',
    });
    return result.customGenre.trim();
  }

  return genre;
}

// ─── Step 2: Mood ───────────────────────────────────────────────────────────

async function askMood() {
  divider();
  const { mood } = await prompt({
    type: 'select',
    name: 'mood',
    message: `${bold('Step 2 of 9:')} What ${cyan('mood')} should the song convey?\n`,
    choices: MOODS.map((m) => ({ name: `${m.name} (${m.hint})`, value: m })),
    pointer: '❯',
    format: (v) => v?.name ?? '',
  });
  return mood;
}

// ─── Step 3: Vocal Style ─────────────────────────────────────────────────────

async function askVocalStyle() {
  divider();
  const { vocalStyle } = await prompt({
    type: 'select',
    name: 'vocalStyle',
    message: `${bold('Step 3 of 9:')} What ${cyan('vocal style')}?\n`,
    choices: VOCAL_STYLES.map((v) => ({ name: `${v.name} — ${v.hint}`, value: v })),
    pointer: '❯',
    format: (v) => v?.name ?? '',
  });
  return vocalStyle;
}

// ─── Step 4: Tempo ─────────────────────────────────────────────────────────

async function askTempo() {
  divider();
  const { tempo } = await prompt({
    type: 'select',
    name: 'tempo',
    message: `${bold('Step 4 of 9:')} What ${cyan('tempo / energy level')}?\n`,
    choices: TEMPO_PRESETS.map((t) => ({ name: `${t.name} — ${t.hint}`, value: t })),
    pointer: '❯',
    format: (v) => v?.name ?? '',
  });
  return tempo;
}

// ─── Step 5: Theme ─────────────────────────────────────────────────────────

async function askTheme() {
  divider();
  const { theme } = await prompt({
    type: 'select',
    name: 'theme',
    message: `${bold('Step 5 of 9:')} What ${cyan('theme or topic')}?\n`,
    choices: THEMES,
    pointer: '❯',
  });

  if (theme === 'Custom theme...') {
    const result = await prompt({
      type: 'input',
      name: 'customTheme',
      message: 'Describe your theme:',
      validate: (s) => s.trim().length >= 3 || 'Please describe the theme',
    });
    return result.customTheme.trim();
  }

  return theme;
}

// ─── Step 6: Instrumental ───────────────────────────────────────────────────

async function askInstrumental(vocalStyle) {
  divider();
  if (vocalStyle.name === 'Instrumental Only') {
    console.log(dim('Instrumental mode selected automatically.\n'));
    return true;
  }

  const { instrumental } = await prompt({
    type: 'confirm',
    name: 'instrumental',
    message: `${bold('Step 6 of 9:')} ${cyan('Instrumental only?')} (no vocals)`,
    initial: false,
  });
  return instrumental;
}

// ─── Step 7: Custom Lyrics ─────────────────────────────────────────────────

async function askCustomLyrics(instrumental) {
  divider();
  if (instrumental) {
    console.log(dim('Skipping lyrics — instrumental mode.\n'));
    return null;
  }

  const { useCustom } = await prompt({
    type: 'confirm',
    name: 'useCustom',
    message: `${bold('Step 7 of 9:')} ${cyan('Write custom lyrics?')} (or let AI generate them)`,
    initial: false,
  });

  if (!useCustom) {
    console.log(dim('AI will generate lyrics based on your song choices.\n'));
    return null;
  }

  const { lyrics } = await prompt({
    type: 'editor',
    name: 'lyrics',
    message: `${bold('✏️  Write your lyrics:')}\n${dim('[verse], [chorus], [bridge] tags supported.')}`,
    waitForInput: true,
  });

  return lyrics.trim();
}

// ─── Step 8: Song Structure ─────────────────────────────────────────────────

async function askStructure(instrumental) {
  divider();
  if (instrumental) {
    console.log(dim('Skipping structure — instrumental mode.\n'));
    return null;
  }

  const { structure } = await prompt({
    type: 'select',
    name: 'structure',
    message: `${bold('Step 8 of 9:')} What ${cyan('song structure')}?\n`,
    choices: SONG_STRUCTURES,
    pointer: '❯',
  });

  if (structure === 'Custom structure...') {
    const result = await prompt({
      type: 'input',
      name: 'customStructure',
      message: 'Enter structure (e.g., [Intro] → [Verse] → [Chorus] → [Outro]):',
      validate: (s) => s.trim().length >= 5,
    });
    return result.customStructure.trim();
  }

  return structure;
}

// ─── Step 9: Extra Details ─────────────────────────────────────────────────

async function askExtraDetails() {
  divider();
  const { extra } = await prompt({
    type: 'input',
    name: 'extra',
    message: `${bold('Step 9 of 9:')} ${cyan('Extra details?')} ${dim('(instruments, references, vibe — or Enter to skip)')}\n`,
    initial: '',
  });
  return extra?.trim() || '';
}

// ─── Build prompt ───────────────────────────────────────────────────────────

function buildPrompt({ genre, mood, tempo, vocalStyle, instrumental, extra }) {
  let parts = [genre, mood.name.toLowerCase(), tempo.name.toLowerCase()];

  if (!instrumental) {
    parts.push(`${vocalStyle.name.toLowerCase()} vocal`);
  }

  parts.push(mood.hint);

  if (extra) {
    parts.push(extra);
  }

  return parts.join(', ');
}

// ─── Build auto lyrics ─────────────────────────────────────────────────────

const LYRIC_TEMPLATES = {
  'Melancholic / Sad': [
    'The rain falls soft on empty streets tonight',
    'Memories linger like the fading light',
    'Each step I take feels heavier than before',
    'I\'m searching for something I can\'t find anymore',
  ],
  'Uplifting / Happy': [
    'The sun is breaking through the clouds today',
    'Every moment feels like a gift, okay?',
    'We\'re dancing through the hours side by side',
    'With you the whole world feels alive',
  ],
  'Energetic / Pumped': [
    'Turn it up, let the bass drop now',
    'We\'re taking over, show us how',
    'Heart racing, adrenaline flows',
    'Nobody knows where the night will go',
  ],
  'Chill / Relaxed': [
    'Sippin\' coffee, watching the world go by',
    'Blue skies stretching, no need to hurry or try',
    'The afternoon light is golden and warm',
    'Nothing to worry about, no storm',
  ],
  'Romantic / Love': [
    'When I look into your eyes I see the stars',
    'Every moment with you takes me far',
    'Your hand in mine feels like coming home',
    'With you, darling, I never feel alone',
  ],
  'Dark / Intense': [
    'Shadows stretch across the broken ground',
    'A different kind of silence, a different sound',
    'We\'re falling through the cracks of what we knew',
    'Nothing left to lose, nothing left to do',
  ],
  'Nostalgic / Reflective': [
    'Do you remember when we used to dream?',
    'Those simpler days feel so far, it seems',
    'Time has changed us but the memories remain',
    'Like photographs that the years can\'t stain',
  ],
  'Playful / Fun': [
    'Running through the sprinklers in the summer heat',
    'Making up the rules as we go down the street',
    'Laughing \'til our bellies ache',
    'The world\'s our playground, no mistake',
  ],
};

function buildAutoLyrics({ mood, structure }) {
  const lines = LYRIC_TEMPLATES[mood.name] || LYRIC_TEMPLATES['Chill / Relaxed'];

  const verse1 = `[verse]\n${lines[0]}\n${lines[1]}`;
  const verse2 = `[verse 2]\n${lines[0].replace('.', ', still')}\n${lines[1].replace('.', ', somehow')}`;
  const chorus = `[chorus]\n${lines[2]}\n${lines[3]}`;
  const bridge = `[bridge]\n${lines[0]}'til the morning comes\n${lines[1]}, I found where I belong`;

  return `${verse1}\n\n${chorus}\n\n${verse2}\n\n${chorus}\n\n${bridge}\n\n${chorus}`;
}

// ─── Review & confirm ───────────────────────────────────────────────────────

async function reviewAndConfirm(answers, promptText, autoLyrics) {
  divider();
  console.log(`${bold('📋  REVIEW YOUR SONG\n')}`);
  console.log(`  ${cyan('Genre:')}     ${answers.genre}`);
  console.log(`  ${cyan('Mood:')}      ${answers.mood.name}`);
  console.log(`  ${cyan('Tempo:')}     ${answers.tempo.name}`);
  console.log(`  ${cyan('Vocals:')}    ${answers.vocalStyle.name}`);
  console.log(`  ${cyan('Theme:')}     ${answers.theme}`);
  console.log(`  ${cyan('Type:')}      ${answers.instrumental ? magenta('Instrumental') : answers.customLyrics ? yellow('Custom lyrics') : green('AI-generated lyrics')}`);
  if (answers.structure) console.log(`  ${cyan('Structure:')} ${answers.structure}`);
  if (answers.extra) console.log(`  ${cyan('Extra:')}     ${answers.extra}`);
  console.log();
  console.log(`${bold('📝  PROMPT:')}`);
  console.log(`  "${dim(promptText)}"`);
  console.log();

  // Show & allow edit of auto-generated lyrics
  if (!answers.instrumental && !answers.customLyrics) {
    console.log(`${bold('📝  AUTO-GENERATED LYRICS (preview):')}`);
    console.log(dim(autoLyrics.split('\n').slice(0, 6).join('\n') + '\n  ...\n'));

    const { useAutoLyrics } = await prompt({
      type: 'confirm',
      name: 'useAutoLyrics',
      message: `${green('Use AI-generated lyrics?')}`,
      initial: true,
    });

    if (!useAutoLyrics) {
      const { editedLyrics } = await prompt({
        type: 'editor',
        name: 'editedLyrics',
        message: `${bold('✏️  Edit your lyrics:')}`,
        waitForInput: true,
      });
      answers.customLyrics = editedLyrics.trim();
    }
  }

  divider();
  const { confirm } = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: `${green('▶️  Generate this song?')}`,
    initial: true,
  });

  return confirm ? answers : null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  showLogo();

  try {
    const genre = await askGenre();
    const mood = await askMood();
    const vocalStyle = await askVocalStyle();
    const tempo = await askTempo();
    const theme = await askTheme();
    const instrumental = await askInstrumental(vocalStyle);
    const customLyrics = await askCustomLyrics(instrumental);
    const structure = await askStructure(instrumental);
    const extra = await askExtraDetails();

    const promptText = buildPrompt({ genre, mood, tempo, vocalStyle, instrumental, extra });
    const autoLyrics = instrumental ? null : buildAutoLyrics({ mood, structure });

    const answers = {
      genre, mood, tempo, vocalStyle, theme,
      instrumental, customLyrics, structure, extra,
    };

    const confirmed = await reviewAndConfirm(answers, promptText, autoLyrics);
    if (!confirmed) {
      console.log(`\n${yellow('Cancelled. Run again to restart the wizard.')}\n`);
      process.exit(0);
    }

    divider();
    console.log(`\n${green('🎵  Generating your song...')}\n`);

    const result = await generateMusic({
      model: 'music-2.6-free',
      prompt: promptText,
      lyrics: confirmed.instrumental ? undefined : (confirmed.customLyrics || autoLyrics),
    });

    if (result.success) {
      console.log(`\n${green('✅  Song generated successfully!')}`);
      if (result.file) console.log(`   Saved: ${result.file}`);
      if (result.preview_url) console.log(`   URL: ${result.preview_url}`);
    } else {
      console.log(`\n${yellow('⚠️  Generation complete — check output above.')}`);
    }

    console.log();
  } catch (err) {
    if (err.name === 'ExitPromptError') {
      console.log(`\n\n${dim('Goodbye! ✨')}\n`);
      process.exit(0);
    }
    throw err;
  }
}

main();
