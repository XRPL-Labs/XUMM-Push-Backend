const crypto = require('crypto')

const debug = require('debug')
const log = debug('xummpush:crypto')

const algorithm = 'aes-256-gcm'
let k = null

const encrypt = text => {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, k, iv)
    const encrypted = Buffer.concat([cipher.update(text, 'utf8', 'buffer'), cipher.final('buffer')])
    const cipherTag = cipher.getAuthTag()
    const output = iv.toString('hex') + '.' + cipherTag.toString('hex') + '.' + encrypted.toString('hex')
    return output
  } catch (e) {
    log('ENCRYPT ERROR', e.message)
  }
  throw new Error('Security violation')
}

const decrypt = data => {
  try {
    const [iv, tag, content] = data.split('.')
    const decipher = crypto.createDecipheriv(algorithm, k, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex')) 
    const decrpyted = Buffer.concat([decipher.update(content, 'hex', 'buffer'), decipher.final('buffer')])
    return decrpyted.toString()
  } catch (e) {
    log('DECRYPT ERROR', e.message)
  }
  throw new Error('Security violation')
}

const setSecret = secret => {
  k = crypto.createHash('sha256')
    .update(secret)
    .digest('hex')
    .slice(0, 32)
}

module.exports = {
  encrypt,
  decrypt,
  setSecret
}
