/**
 * Pixel glyphs for instance icons, drawn on a 12x12 grid.
 * "#" is solid white, "o" is half-white for shading.
 */
const ART: Record<string, string> = {
  pickaxe: `
..########..
.##......##.
##...##...##
#....##....#
.....##.....
.....##.....
.....##.....
.....##.....
.....##.....
.....##.....
.....##.....
.....##.....`,
  sword: `
.....##.....
....#oo#....
....#oo#....
....#oo#....
....#oo#....
....#oo#....
....#oo#....
.##########.
.##########.
.....##.....
.....##.....
....####....`,
  axe: `
.......##...
...######...
..##o####...
.##oo####...
.##oo####...
..##o####...
...######...
.......##...
.......##...
.......##...
.......##...
.......##...`,
  shield: `
.##########.
.#oooooooo#.
.#oo####oo#.
.#oo#..#oo#.
.#oo####oo#.
.#oooooooo#.
.#oooooooo#.
..#oooooo#..
..#oooooo#..
...#oooo#...
....#oo#....
.....##.....`,
  tree: `
....####....
..##oo####..
.#oo########
.#o#########
############
.##########.
..########..
.....##.....
.....##.....
.....##.....
.....##.....
...######...`,
  mountain: `
............
.....#......
....###.....
...#ooo#....
...#####..#.
..#######.##
..##########
.###########
############
############
............
............`,
  castle: `
##.##..##.##
##.##..##.##
############
############
.##########.
.##########.
.####..####.
.###....###.
.###....###.
.###....###.
.##########.
............`,
  gem: `
............
...######...
..#oo##oo#..
.##oo##oo##.
############
.##########.
..########..
...######...
....####....
.....##.....
............
............`,
  crown: `
............
............
#....##....#
##..####..##
###.####.###
############
############
#oo##oo##oo#
############
############
............
............`,
  flame: `
......#.....
.....##.....
.....###....
....####..#.
..#.#####.#.
..#########.
.####o#####.
.###ooo####.
.###oooo###.
.####oo####.
..########..
...######...`,
  potion: `
....####....
.....##.....
.....##.....
....#..#....
...#....#...
..#......#..
.#oooooooo#.
.#oooooooo#.
.#oooooooo#.
.#oooooooo#.
..#oooooo#..
...######...`,
  heart: `
............
.###....###.
#ooo#..#####
#oo#########
#o##########
############
.##########.
..########..
...######...
....####....
.....##.....
............`,
  star: `
.....##.....
.....##.....
....####....
############
.####oo####.
..###oo###..
...######...
..########..
..###..###..
.###....###.
.##......##.
............`,
  fish: `
............
............
....####....
..#######..#
.##o#####.##
##########..
##########..
.########.##
..#######..#
....####....
............
............`,
  skull: `
..########..
.##########.
############
############
##..####..##
##..####..##
############
#####..#####
.##########.
..#.#..#.#..
..########..
............`,
  moon: `
...#####....
..###.......
.###........
.##.........
###.........
###.........
###.........
###.........
.##.........
.###......#.
..#########.
...#######..`
}

/** Glyph names from earlier versions, mapped to the closest one we still draw. */
const RENAMED: Record<string, string> = {
  swords: 'sword',
  hammer: 'axe',
  leaf: 'tree',
  sprout: 'tree',
  tent: 'castle',
  ship: 'fish',
  compass: 'star',
  map: 'mountain',
  zap: 'flame',
  wand: 'potion',
  sun: 'star',
  snowflake: 'star',
  sparkles: 'star',
  bird: 'fish',
  cat: 'fish',
  bone: 'skull',
  ghost: 'skull',
  rocket: 'star',
  puzzle: 'gem',
  cherry: 'heart'
}

export const GLYPH_NAMES = Object.keys(ART)

type Pixel = { x: number; y: number; half: boolean }

export function glyphPixels(name: string): Pixel[] {
  const rows = (ART[name] ?? ART[RENAMED[name]] ?? ART.pickaxe).trim().split('\n')
  const pixels: Pixel[] = []
  rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && pixels.push({ x, y, half: c === 'o' })))
  return pixels
}

/** One <path> per shade keeps the markup small. */
export function glyphSvg(name: string, size: number): string {
  const px = glyphPixels(name)
  const d = (half: boolean) =>
    px
      .filter((p) => p.half === half)
      .map((p) => `M${p.x} ${p.y}h1v1h-1z`)
      .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 12 12" shape-rendering="crispEdges"><path d="${d(false)}" fill="#fff"/><path d="${d(true)}" fill="#fff" fill-opacity=".55"/></svg>`
}
