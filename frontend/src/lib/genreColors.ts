import type { GameProjection } from '#/hooks/useGameProjections';

export type RGB = [number, number, number]

export const GENRE_PALETTE = [
  '#e74c3c', // red
  '#9b59b6', // purple
  '#16a085', // teal
  '#f39c12', // orange
  '#3498db', // blue
  '#2ecc71', // green
  '#f1c40f', // yellow
  '#1abc9c', // turquoise
  '#e67e22', // pumpkin
  '#8e44ad', // violet
  '#2980b9', // dark blue
  '#27ae60', // dark green
]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255)
  // three.js treats vertex color attributes as linear; convert sRGB -> linear
  return srgb.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))) as RGB
}

const FALLBACK_COLOR: RGB = hexToRgb('#9db4d0')

export function parseGenres(genres: string | undefined | null): string[] {
  if (!genres) return []
  return genres.split(',').map(g => g.trim()).filter(Boolean)
}

export function buildGenreColorMap(games: GameProjection[]): Map<string, RGB> {
  const counts = new Map<string, number>()
  for (const game of games) {
    for (const genre of parseGenres(game.genres)) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1)
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, GENRE_PALETTE.length)

  return new Map(top.map(([genre], i) => [genre, hexToRgb(GENRE_PALETTE[i % GENRE_PALETTE.length])]))
}

export function genreColorFor(genres: string | undefined | null, colorMap: Map<string, RGB>): RGB {
  const parsed = parseGenres(genres)
  if (parsed.length === 0) return FALLBACK_COLOR

  return colorMap.get(parsed[0]) ?? FALLBACK_COLOR
}