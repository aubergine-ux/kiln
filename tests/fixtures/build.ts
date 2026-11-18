import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import yazl from 'yazl'

/** Helpers that build small, realistic test files: jars, packs, worlds, launcher folders. */

export async function makeZip(file: string, entries: Record<string, string | Buffer>): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const zip = new yazl.ZipFile()
  for (const [name, data] of Object.entries(entries)) zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), name)
  zip.end()
  await new Promise<void>((resolve, reject) => zip.outputStream.pipe(createWriteStream(file)).on('close', resolve).on('error', reject))
  return file
}

/** A 2x2 PNG (enough for image decoders). */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8DwnwEIGBgY/jMwAAAp0AL+3mFmfwAAAABJRU5ErkJggg==',
  'base64'
)

export const fabricMod = (dir: string, id: string, name: string, version = '1.0.0') =>
  makeZip(path.join(dir, `${id}-${version}.jar`), {
    'fabric.mod.json': JSON.stringify({ schemaVersion: 1, id, name, version, description: `${name} does useful things.`, authors: ['Ada', { name: 'Grace' }], icon: `assets/${id}/icon.png` }),
    [`assets/${id}/icon.png`]: PNG
  })

export const forgeMod = (dir: string, id: string, name: string) =>
  makeZip(path.join(dir, `${id}-forge.jar`), {
    'META-INF/mods.toml': `modLoader="javafml"\nloaderVersion="[47,)"\nlogoFile="logo.png"\n[[mods]]\nmodId="${id}"\nversion="\${file.jarVersion}"\ndisplayName="${name}"\ndescription='''\nA forge mod.\n'''\nauthors="Linus"\n`,
    'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\nImplementation-Version: 2.3.4\n',
    'logo.png': PNG
  })

export const quiltMod = (dir: string, id: string, name: string) =>
  makeZip(path.join(dir, `${id}-quilt.jar`), {
    'quilt.mod.json': JSON.stringify({ schema_version: 1, quilt_loader: { id, version: '0.5.0', metadata: { name, description: 'Quilted.', contributors: { Tess: 'Owner' }, icon: 'icon.png' } } }),
    'icon.png': PNG
  })

export const legacyMod = (dir: string, id: string, name: string) =>
  makeZip(path.join(dir, `${id}-legacy.jar`), {
    'mcmod.info': `[\n{\n"modid": "${id}",\n"name": "${name}",\n"version": "1.4",\n"description": "Old style\twith a tab",\n"authorList": ["Notch"]\n}\n]`
  })

export const resourcePack = (dir: string, name: string, description: unknown) =>
  makeZip(path.join(dir, `${name}.zip`), {
    'pack.mcmeta': JSON.stringify({ pack: { pack_format: 34, description } }),
    'pack.png': PNG,
    'assets/minecraft/textures/block/stone.png': PNG
  })

export const dataPack = (dir: string, name: string) =>
  makeZip(path.join(dir, `${name}.zip`), {
    'pack.mcmeta': JSON.stringify({ pack: { pack_format: 48, description: 'More loot' } }),
    'data/demo/loot_table/x.json': '{}'
  })

export const shaderPack = (dir: string, name: string) => makeZip(path.join(dir, `${name}.zip`), { 'shaders/composite.fsh': 'void main(){}' })

// ---------- NBT writing (just enough for level.dat) ----------

type Tag = { t: 'byte' | 'int' | 'long' | 'string' | 'compound'; v: unknown }
export const nbt = {
  byte: (v: number): Tag => ({ t: 'byte', v }),
  int: (v: number): Tag => ({ t: 'int', v }),
  long: (v: number): Tag => ({ t: 'long', v }),
  string: (v: string): Tag => ({ t: 'string', v }),
  compound: (v: Record<string, Tag>): Tag => ({ t: 'compound', v })
}
const IDS = { byte: 1, int: 3, long: 4, string: 8, compound: 10 }

function str(s: string): Buffer {
  const b = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(2)
  len.writeUInt16BE(b.length)
  return Buffer.concat([len, b])
}

function payload(tag: Tag): Buffer {
  switch (tag.t) {
    case 'byte':
      return Buffer.from([tag.v as number])
    case 'int': {
      const b = Buffer.alloc(4)
      b.writeInt32BE(tag.v as number)
      return b
    }
    case 'long': {
      const b = Buffer.alloc(8)
      b.writeBigInt64BE(BigInt(tag.v as number))
      return b
    }
    case 'string':
      return str(tag.v as string)
    case 'compound': {
      const parts: Buffer[] = []
      for (const [k, child] of Object.entries(tag.v as Record<string, Tag>)) parts.push(Buffer.from([IDS[child.t]]), str(k), payload(child))
      parts.push(Buffer.from([0]))
      return Buffer.concat(parts)
    }
  }
}

export function levelDat(name: string, lastPlayed: number, gameType = 0, version = '1.21.1'): Buffer {
  const root = nbt.compound({
    Data: nbt.compound({
      LevelName: nbt.string(name),
      LastPlayed: nbt.long(lastPlayed),
      GameType: nbt.int(gameType),
      hardcore: nbt.byte(0),
      Version: nbt.compound({ Name: nbt.string(version) })
    })
  })
  return gzipSync(Buffer.concat([Buffer.from([10]), str(''), payload(root)]))
}

export async function makeWorld(savesDir: string, folder: string, name: string, lastPlayed = Date.now()): Promise<string> {
  const dir = path.join(savesDir, folder)
  await fs.mkdir(path.join(dir, 'region'), { recursive: true })
  await fs.writeFile(path.join(dir, 'level.dat'), levelDat(name, lastPlayed))
  await fs.writeFile(path.join(dir, 'icon.png'), PNG)
  await fs.writeFile(path.join(dir, 'region', 'r.0.0.mca'), Buffer.alloc(4096, 7))
  return dir
}

/** A fake .minecraft with one vanilla version and one Fabric version installed. */
export async function makeMinecraftDir(dir: string): Promise<string> {
  const v = async (id: string, json: object) => {
    await fs.mkdir(path.join(dir, 'versions', id), { recursive: true })
    await fs.writeFile(path.join(dir, 'versions', id, `${id}.json`), JSON.stringify({ id, ...json }))
  }
  await v('1.21.1', { type: 'release', releaseTime: '2024-08-08T12:24:45+00:00', mainClass: 'net.minecraft.client.main.Main' })
  await v('fabric-loader-0.16.9-1.21.1', {
    inheritsFrom: '1.21.1',
    mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
    libraries: [{ name: 'net.fabricmc:fabric-loader:0.16.9' }, { name: 'net.fabricmc:intermediary:1.21.1' }]
  })
  return dir
}
