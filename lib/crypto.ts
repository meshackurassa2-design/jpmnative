const forge = require('node-forge')
import * as Crypto from 'expo-crypto'

const keyCache = new Map<string, string>()

// Fast AES key derivation using SHA-256
async function getFastAesKey(secret: string): Promise<string> {
  if (keyCache.has(secret)) return keyCache.get(secret)!
  const hashHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secret)
  const key = forge.util.hexToBytes(hashHex)
  keyCache.set(secret, key)
  return key
}

// Slow PBKDF2 key derivation (synchronous to avoid async event loop bugs in Hermes)
function getLegacyAesKey(secret: string): string {
  const cacheKey = secret + '_legacy'
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey)!
  
  const key = forge.pkcs5.pbkdf2(secret, 'meme-sharing-salt', 100000, 32, forge.md.sha256.create())
  keyCache.set(cacheKey, key)
  return key
}

export async function encryptMessage(text: string, secret: string): Promise<string> {
  try {
    const key = await getFastAesKey(secret)
    const iv = forge.random.getBytesSync(12)
    
    const cipher = forge.cipher.createCipher('AES-GCM', key)
    cipher.start({ iv: forge.util.createBuffer(iv, 'binary'), tagLength: 128 })
    cipher.update(forge.util.createBuffer(text, 'utf8'))
    cipher.finish()
    
    const encrypted = cipher.output.getBytes()
    const tag = cipher.mode.tag.getBytes()
    
    const result = iv + encrypted + tag
    const b64 = forge.util.encode64(result)
    
    return 'encrypted_v2:' + b64
  } catch (err) {
    console.error('Encryption failed:', err)
    throw new Error('Message encryption failed to protect user privacy.')
  }
}

export async function decryptMessage(ciphertext: string, secret: string, isInbox: boolean = false): Promise<string> {
  if (!ciphertext.startsWith('encrypted:') && !ciphertext.startsWith('encrypted_v2:')) {
    return ciphertext
  }

  const isV2 = ciphertext.startsWith('encrypted_v2:')
  const b64 = ciphertext.replace(/encrypted_v2:|encrypted:/, '')
  
  // 2. AES-GCM Decryption (Fast for v2, Slow for legacy)
  try {
    const raw = forge.util.decode64(b64)
    
    if (raw.length >= 28) {
      // If we are in the inbox and this is a legacy AES-GCM message, skip the slow PBKDF2 to prevent freezing
      if (!isV2 && isInbox) {
        return '🔒 Encrypted Message'
      }

      const iv = raw.substring(0, 12)
      const tag = raw.substring(raw.length - 16)
      const encrypted = raw.substring(12, raw.length - 16)
      
      const key = isV2 ? await getFastAesKey(secret) : getLegacyAesKey(secret)
      
      const decipher = forge.cipher.createDecipher('AES-GCM', key)
      decipher.start({ 
        iv: forge.util.createBuffer(iv, 'binary'), 
        tagLength: 128, 
        tag: forge.util.createBuffer(tag, 'binary') 
      })
      decipher.update(forge.util.createBuffer(encrypted, 'binary'))
      const pass = decipher.finish()
      
      if (pass) {
        return decipher.output.toString('utf8')
      }
    }
  } catch (err) {
    // Suppress and fallback
  }

  // If V2 failed, fallback gracefully instead of displaying Corrupted Message
  if (isV2) return '🔒 Encrypted Message'

  // 3. Legacy XOR (for old 'encrypted:' messages)
  try {
    const Buffer = require('buffer').Buffer
    const encrypted = Buffer.from(b64, 'base64').toString('binary')
    const hashHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secret)
    
    let result = ''
    for (let i = 0; i < encrypted.length; i++) {
      result += String.fromCharCode(encrypted.charCodeAt(i) ^ hashHex.charCodeAt(i % hashHex.length))
    }
    return result
  } catch (err) {
    // Suppress and fallback
  }

  return '🔒 Encrypted Message'
}

export function getSharedSecret(userId1: string, userId2: string): string {
  if (!userId1 || !userId2) return ''
  return [userId1.toString().toLowerCase().trim(), userId2.toString().toLowerCase().trim()].sort().join('-')
}
