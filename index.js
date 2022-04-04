require('dotenv').config()

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const debug = require('debug')

const log = debug('xummpush')
const log_redis = log.extend('redis')
const log_error = log.extend('error')

const express = require('express')
const morgan = require('morgan-debug')
const helmet = require('helmet')
const ioredis = require('ioredis')

// TODO: INFORM MATTERMOST ABOUT A NEW BOOT
//       SO THE ENCRYPTION KEY CAN BE INJECTED
log({____TODO____: 'INFORM MATTERMOST ABOUT A NEW BOOT'})

const { encrypt, decrypt, setSecret } = require('./crypto')
let k = null

if (typeof process.env?.FCM_KEY === 'string') {
  k = process.env.FCM_KEY.trim()
  setSecret(k)
  log(
    `\n\n       WARNING! FCM KEY LOADED FROM ENV, PLEASE DO NOT DO THIS IN PRODUCTION!\n` 
    + `       IN PROD, USE FCM KEY INJECTION THROUGH /boot { 'key': '...' }\n\n\n`
  )
}

const PORT = Number(process.env.PORT || 2000) || 2000

// deepcode ignore UseCsurfForExpress: only called server2server as API
const app = express()

app.use(morgan('xummpush:httplog', 'combined'))
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json())

const redis = new ioredis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: [1, '1', true, 'true', 'yes', 'YES', 'y', 'Y'].indexOf(process.env.REDIS_TLS) > -1,
  autoResendUnfulfilledCommands: true,
  maxRetriesPerRequest: null
})

redis.on('connect', _ => log_redis('REDIS connected'))
redis.on('ready', _ => log_redis('REDIS ready'))
redis.on('close', _ => log_redis('REDIS disconnected'))
redis.on('error', e => log_redis('Error', e))

log('Starting app...')

app.get('/', async (req, res) => {
  res.send({
    moment: new Date()
  }) 
})

app.post('/send/:device([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})', async (req, res) => {
  try {
    if (typeof req.body !== 'object' || req.body === null) {
      throw new Error('Invalid push body')
    }

    const device = req.params?.device
    let token = decrypt(await redis.get(device))
    
    if (token.slice(0, 1) + token.slice(-1) !== '||') {
      throw new Error('Decryption failed')
    }

    // Decryption succeeded
    token = token.slice(1, -1)

    if (!token) {
      throw new Error('Cannot route message')
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'post',
      body: JSON.stringify({
        ...req.body,
        to: token
      }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + k
      }
    })

    const responseText = await response.text()

    log('Push response', response.status, responseText) // , response.headers

    if (response.headers?.['content-type']) {
      res.set('content-type', response.headers['content-type'])
    }

    res
      .status(response.status || 200)
      .end(responseText)

    // res.json({
    //   device,
    //   responseText,
    //   moment: new Date()
    // })
  } catch (e) {
    res.json({
      moment: new Date(),
      error: e?.message || e
    })
  }
})

app.post('/register/:device([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89ABab][0-9a-fA-F]{3}-[0-9a-fA-F]{12})', async (req, res) => {
  try {
    const device = req.params?.device
    const token = req.body?.token

    await redis.set(device, encrypt('|' + token + '|'))

    res.json({
      moment: new Date(),
      stored: true,
      device,
    })
  } catch (e) {
    res.json({
      moment: new Date(),
      error: e?.message || e
    })
  }
})

app.post('/boot', async (req, res) => {
  try {
    k = req?.body?.key
    if (typeof k !== 'string') {
      throw new Error('Invalid type')
    }
    k = k.trim()
    setSecret(k)
    res.json({set: true})
  } catch (e) {
    res.json({
      moment: new Date(),
      error: e?.message || e
    })
  }
})

app.use((err, req, res, next) => {
  log_error(err)
  res.status(500).json({
    moment: new Date(),
    error: e?.message || e
  })
})

app.listen(PORT, () => {
  log(`XUMM Push Service listening at port: ${PORT}`)
})
