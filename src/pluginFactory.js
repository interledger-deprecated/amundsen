'use strict'

const http = require('http')
const https = require('https')
const LE = require('greenlock').LE
const leChallengeFs = require('le-challenge-fs')
const leAcmeCore = require('le-acme-core')
const leStoreBot = require('le-store-certbot')
const WebSocket = require('ws')
const BtpPacket = require('btp-packet')
const BtpFrog = require('btp-toolbox').Frog
const PeerLedger = require('./peerLedger')
const Plugin17q4 = require('ilp-plugin-payment-channel-framework')

// config contains: 
// socket
// name
// token
// peerInitialBalance
// baseLedger

function pluginMaker (version, config) {
  let myPlugin
  let promise = Promise.resolve()
  if (version === '17q3') {
    const peerLedger = new PeerLedger({
      prefix: config.baseLedger + config.name + '.',
      currencyCode: 'USD',
      currencyScale: 9,
      connectors: [ config.baseLedger + config.name + '.server' ], // the peer should send to me
      minBalance: 0, // applies for peer's balance; 17q3 balance protocol doesn't support negative balances
      maxBalance: Infinity // applies for peer's balance; my balance is not limited
    }, config.initialBalancePerPeer)
    console.log('peerLedger made from config', config.initialBalancePerPeer)
    const frog = new BtpFrog(peerLedger.getPlugin('client'), (obj) => {
      console.log('serializing object from Frog', obj)
      const msg = BtpPacket.serialize(obj, BtpPacket.BTP_VERSION_ALPHA)
      config.socket.send(msg)
    }, BtpPacket.BTP_VERSION_ALPHA)
    config.socket.on('message', (msg) => {
      const obj = BtpPacket.deserialize(msg, BtpPacket.BTP_VERSION_ALPHA)
      frog.handleMessage(obj)
    })
    myPlugin = peerLedger.getPlugin('server')
  } else {
    const store = {}
    myPlugin = new Plugin17q4({
      prefix: config.baseLedger + config.name + '.',
      info: {
        currencyCode: 'USD',
        currencyScale: 9,
        connectors: [ config.baseLedger + 'connector' ],
        minBalance: 0, // 17q3 balance protocol doesn't support negative balances
        maxBalance: Infinity
      },
      authCheck: function (username, token) {
        console.log('authCheck', username, token)
        return (username === 'client2' && token === 'bar')
      },
      maxBalance: '1000000000',
      _store: {
        get: (k) => store[k],
        put: (k, v) => { store[k] = v },
        del: (k) => delete store[k]
      }
    })
    promise = myPlugin.addSocket(config.socket)
  }
  myPlugin.isPrivate = true // means voucher will not promote this plugin's account as a connector
  return promise.then(() => myPlugin)
}

// 0: '', 1: 'api', 2: version, 3: name (17q3 only), 4: token (17q3 only)
// e.g. wss://amundsen.ilpdemo.org/api/17q3/bob/bobbob          
const URL_PATH_PART_VERSION = 2
const URL_PATH_PART_NAME = 3
const URL_PATH_PART_TOKEN = 4

const WELCOME_TEXT = 'This is a BTP server, please upgrade to WebSockets.'
const LE_ROOT = '~/letsencrypt'
const HTTP_REDIRECT_PORT = 80
const HTTPS_PORT = 443

// This function starts a TLS webserver on HTTPS_PORT, with on-the-fly LetsEncrypt cert registration.
// It also starts a redirect server on HTTP_REDIRECT_PORT, which GreenLock uses for the ACME challenge.
// Certificates and temporary files are stored in LE_ROOT
function getLetsEncryptServers (domain) {
  let httpServer
  const le = LE.create({
    // server: 'staging',
    server: 'https://acme-v01.api.letsencrypt.org/directory',
    acme: leAcmeCore.ACME.create(),
    store: leStoreBot.create({ configDir: LE_ROOT + '/etc', webrootPath: LE_ROOT + '/var/:hostname' }),
    challenges: { 'http-01': leChallengeFs.create({ webrootPath: LE_ROOT + '/var/:hostname' }) },
    agreeToTerms: function (tosUrl, cb) { cb(null, tosUrl) },
    debug: true
  })
  return new Promise((resolve, reject) => {
    httpServer = http.createServer(le.middleware())
    httpServer.listen(HTTP_REDIRECT_PORT, (err) => {
      if (err) { reject(err) } else { resolve() }
    })
  }).then(() => {
    return le.core.certificates.getAsync({
      email: `letsencrypt+${domain}@gmail.com`,
      domains: [ domain ]
    })
  }).then(function (certs) {
    if (!certs) {
      throw new Error('Should have acquired certificate for domains.')
    }
    return new Promise((resolve, reject) => {
      const httpsServer = https.createServer({
        key: certs.privkey,
        cert: certs.cert,
        ca: certs.chain
      }, (req, res) => {
        res.end(WELCOME_TEXT)
      })
      httpsServer.listen(HTTPS_PORT, (err) => {
        if (err) { reject(err) } else { resolve([ httpsServer, httpServer ]) }
      })
    })
  })
}

function PluginFactory (config, onPlugin) {
  this.serversToClose = []
  this.config = config
  this.onPlugin = onPlugin
  // this.myBaseUrl
}

PluginFactory.prototype = {
  getServers () {
    // case 1: use LetsEncrypt => [https, http]
    if (this.config.tls) {
      this.myBaseUrl = 'wss://' + this.config.tls
      return getLetsEncryptServers(this.config.tls)
    }

    // case 2: don't run a server => []
    if (typeof this.config.listen !== 'number') {
      return Promise.resolve([])
    }

    // case 3: listen without TLS on a port => [http]
    this.myBaseUrl = 'ws://localhost:' + this.config.listen
    const server = http.createServer((req, res) => {
      res.end(WELCOME_TEXT)
    })
    return new Promise(resolve => server.listen(this.config.listen, resolve([ server ])))
  },

  start () {
    return this.getServers().then(servers => {
      this.serversToClose = servers
      if (servers.length) {
        this.wss = new WebSocket.Server({ server: servers[0] })
        this.serversToClose.push(this.wss)
        this.wss.on('connection', (ws, httpReq) => {
          const parts = httpReq.url.split('/')
          pluginMaker(parts[URL_PATH_PART_VERSION], {
            name: parts[URL_PATH_PART_NAME],
            token: parts[URL_PATH_PART_TOKEN],
            socket: ws,
            initialBalancePerPeer: this.config.initialBalancePerPeer,
            baseLedger: this.config.baseLedger
          }).then(plugin => {
            if (!plugin) {
              ws.send('URL path not supported, try /api/17q3/user/pass or /api/17q4')
              ws.close()
              return
            }
            console.log('plugin instantiated')
            return plugin.connect().then(() => {
              console.log('plugin connected', plugin.getAccount(), parts)
              console.log('plugin factory calls onPlugin')
              this.onPlugin(plugin)
            })
          }).catch(err => {
            console.error('could not connect plugin for ' + httpReq.url + ': ' + err.message)
          })
       })
      }
    })
  },

  stop () {
    // close http, https, ws/wss servers:
    return Promise.all(this.serversToClose.map(server => {
      return new Promise((resolve) => {
        server.close(resolve)
      })
    }))
  }
}

module.exports = PluginFactory