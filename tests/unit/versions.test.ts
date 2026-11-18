import { describe, expect, it } from 'vitest'
import { classifyVersion, isVersionReady } from '../../src/main/launcher/versions'
import { loaderFromComponents, loaderFromCurseForge, loaderFromMrpack, resolveVersionId } from '../../src/main/modpacks/resolve'

describe('classifyVersion', () => {
  it('detects vanilla', () => {
    expect(classifyVersion({ id: '1.21.1', type: 'release' })).toMatchObject({ loader: 'vanilla', mcVersion: '1.21.1' })
  })
  it('detects fabric from its libraries', () => {
    const v = classifyVersion({ id: 'fabric-loader-0.16.9-1.21.1', inheritsFrom: '1.21.1', libraries: [{ name: 'net.fabricmc:fabric-loader:0.16.9' }] })
    expect(v).toMatchObject({ loader: 'fabric', loaderVersion: '0.16.9', mcVersion: '1.21.1' })
  })
  it('detects quilt', () => {
    expect(classifyVersion({ id: 'quilt-loader-0.26.4-1.21', inheritsFrom: '1.21', libraries: [{ name: 'org.quiltmc:quilt-loader:0.26.4' }] }).loader).toBe('quilt')
  })
  it('detects modern forge from its arguments', () => {
    const v = classifyVersion({
      id: '1.20.1-forge-47.3.0',
      inheritsFrom: '1.20.1',
      libraries: [{ name: 'net.minecraftforge:fmlloader:1.20.1-47.3.0' }],
      arguments: { game: ['--fml.forgeVersion', '47.3.0', '--fml.mcVersion', '1.20.1'] }
    })
    expect(v).toMatchObject({ loader: 'forge', loaderVersion: '47.3.0', mcVersion: '1.20.1' })
  })
  it('detects neoforge', () => {
    const v = classifyVersion({ id: 'neoforge-21.1.77', inheritsFrom: '1.21.1', libraries: [{ name: 'net.neoforged.fancymodloader:loader:4.0.29' }], arguments: { game: ['--fml.neoForgeVersion', '21.1.77'] } })
    expect(v).toMatchObject({ loader: 'neoforge', loaderVersion: '21.1.77', mcVersion: '1.21.1' })
  })
  it('detects legacy forge without inheritsFrom', () => {
    const v = classifyVersion({ id: '1.7.10-Forge10.13.4.1614-1.7.10', mainClass: 'net.minecraft.launchwrapper.Launch', libraries: [{ name: 'net.minecraftforge:forge:1.7.10-10.13.4.1614-1.7.10' }] })
    expect(v).toMatchObject({ loader: 'forge', mcVersion: '1.7.10' })
  })
})

describe('isVersionReady', () => {
  const installed = [classifyVersion({ id: '1.21.1' })]
  it('trusts the launcher to download vanilla versions', () => {
    expect(isVersionReady('1.20.4', installed)).toBe(true)
    expect(isVersionReady('latest-release', installed)).toBe(true)
  })
  it('requires loaders to be installed', () => {
    expect(isVersionReady('fabric-loader-0.16.9-1.21.1', installed, 'fabric')).toBe(false)
  })
})

describe('loader resolution', () => {
  it('maps modpack dependency formats', () => {
    expect(loaderFromMrpack({ minecraft: '1.21.1', 'fabric-loader': '0.16.9' })).toEqual({ mc: '1.21.1', loader: 'fabric', loaderVersion: '0.16.9' })
    expect(loaderFromCurseForge('forge-47.2.0')).toEqual({ loader: 'forge', loaderVersion: '47.2.0' })
    expect(loaderFromCurseForge('neoforge-21.1.77')).toEqual({ loader: 'neoforge', loaderVersion: '21.1.77' })
    expect(loaderFromComponents([{ uid: 'net.minecraft', version: '1.20.1' }, { uid: 'net.minecraftforge', version: '47.2.0' }])).toEqual({ mc: '1.20.1', loader: 'forge', loaderVersion: '47.2.0' })
  })
  it('prefers an installed version, otherwise the installer naming', () => {
    const installed = [classifyVersion({ id: 'fabric-loader-0.16.9-1.21.1', inheritsFrom: '1.21.1', libraries: [{ name: 'net.fabricmc:fabric-loader:0.16.9' }] })]
    expect(resolveVersionId(installed, 'fabric', '1.21.1', '0.16.9')).toBe('fabric-loader-0.16.9-1.21.1')
    expect(resolveVersionId(installed, 'forge', '1.20.1', '47.2.0')).toBe('1.20.1-forge-47.2.0')
    expect(resolveVersionId(installed, 'neoforge', '1.21.1', '21.1.77')).toBe('neoforge-21.1.77')
  })
})
