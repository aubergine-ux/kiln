import { gunzipSync } from 'node:zlib'

/**
 * A tiny reader for the NBT format used by level.dat.
 * Only reading is supported; values come back as plain JS objects.
 * Longs are returned as numbers (fine for timestamps).
 */
export type NbtValue = number | string | NbtValue[] | { [key: string]: NbtValue } | number[]

export function readNbt(data: Buffer): Record<string, NbtValue> {
  const buf = data[0] === 0x1f && data[1] === 0x8b ? gunzipSync(data) : data
  let pos = 0

  const u8 = () => buf.readUInt8(pos++)
  const i16 = () => ((pos += 2), buf.readInt16BE(pos - 2))
  const i32 = () => ((pos += 4), buf.readInt32BE(pos - 4))
  const i64 = () => ((pos += 8), Number(buf.readBigInt64BE(pos - 8)))
  const f32 = () => ((pos += 4), buf.readFloatBE(pos - 4))
  const f64 = () => ((pos += 8), buf.readDoubleBE(pos - 8))
  const str = () => {
    const len = buf.readUInt16BE(pos)
    pos += 2
    const s = buf.toString('utf8', pos, pos + len)
    pos += len
    return s
  }

  const payload = (type: number): NbtValue => {
    switch (type) {
      case 1: return buf.readInt8(pos++)
      case 2: return i16()
      case 3: return i32()
      case 4: return i64()
      case 5: return f32()
      case 6: return f64()
      case 7: {
        const len = i32()
        const arr = Array.from(buf.subarray(pos, pos + len))
        pos += len
        return arr
      }
      case 8: return str()
      case 9: {
        const itemType = u8()
        const len = i32()
        const list: NbtValue[] = []
        for (let i = 0; i < len; i++) list.push(payload(itemType))
        return list
      }
      case 10: {
        const obj: Record<string, NbtValue> = {}
        for (;;) {
          const t = u8()
          if (t === 0) break
          const name = str()
          obj[name] = payload(t)
        }
        return obj
      }
      case 11: {
        const len = i32()
        const arr: number[] = []
        for (let i = 0; i < len; i++) arr.push(i32())
        return arr
      }
      case 12: {
        const len = i32()
        const arr: number[] = []
        for (let i = 0; i < len; i++) arr.push(i64())
        return arr
      }
      default:
        throw new Error(`Unknown NBT tag ${type}`)
    }
  }

  const rootType = u8()
  if (rootType !== 10) throw new Error('Not an NBT compound')
  str()
  return payload(10) as Record<string, NbtValue>
}
