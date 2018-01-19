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
const Bmp = require('./bmp')

const SERVER_THAT_GETS_TO_SERVE_BTP = 0

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
    const frog = new BtpFrog(peerLedger.getPlugin('client'), (obj) => {
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
      authCheck: config.authCheck,
      maxBalance: '1000000000',
      _store: {
        get: (k) => Promise.resolve(store[k]),
        put: (k, v) => { store[k] = v; return Promise.resolve() },
        del: (k) => { delete store[k]; return Promise.resolve() }
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

const WELCOME_TEXT = '<a href="https://github.com/interledgerjs/amundsen"><h2>This is a BTP server, please upgrade to WebSockets.</h2><img src="https://oceanwide-4579.kxcdn.com/uploads/media-dynamic/cache/jpg_optimize/uploads/media/default/0001/09/thumb_8845_default_1600.jpeg"></a>'
const LE_ROOT = '~/letsencrypt'
const HTTP_REDIRECT_PORT = 80
const HTTPS_PORT = 443

// This function starts a TLS webserver on HTTPS_PORT, with on-the-fly LetsEncrypt cert registration.
// It also starts a redirect server on HTTP_REDIRECT_PORT, which GreenLock uses for the ACME challenge.
// Certificates and temporary files are stored in LE_ROOT
function getLetsEncryptServers (domain, email, bmpPort) {
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
      email,
      domains: [ domain ]
    })
  }).then(function (certs) {
    function makeHttpsServer(certs, port) {
      return new Promise((resolve, reject) => {
        const httpsServer = https.createServer({
          key: certs.privkey,
          cert: certs.cert,
          ca: certs.chain
        }, (req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(WELCOME_TEXT)
        })
        httpsServer.listen(port, (err) => {
          if (err) { reject(err) } else { resolve(httpsServer) }
        })
      })
    }

    if (!certs) {
      throw new Error('Should have acquired certificate for domains.')
    }

    return Promise.all([
      makeHttpsServer(certs, HTTPS_PORT), // SERVER_THAT_GETS_TO_SERVE_BTP = 0
      Promise.resolve(httpServer),
      makeHttpsServer(certs, bmpPort) // third server is bmp server
    ])
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
    // case 1: use LetsEncrypt => [httpsMain, http, httpsBmp] 
    // SERVER_THAT_GETS_TO_SERVE_BTP = 0
    if (this.config.tls) {
      this.myBaseUrl = 'wss://' + this.config.tls
      console.log('tls-ing it!', this.config.tls)
      return getLetsEncryptServers(this.config.tls, this.config.email || `letsencrypt+${this.config.tls}@gmail.com`, this.config.bmpPort).then(servers => {
        if (servers.length === 3) {
          this._startBmp(servers[2])
        }
        return servers
      })
    }

    // case 2: listen without TLS on a port => [httpMain, httpBmp]
    // SERVER_THAT_GETS_TO_SERVE_BTP = 0
    const promises = []
    if (typeof this.config.listen === 'number') {
      const server = http.createServer((req, res) => {
        res.end(WELCOME_TEXT)
      })
      promises.push(new Promise(resolve => server.listen(this.config.listen, resolve(server))))
      this.myBaseUrl = 'ws://localhost:' + this.config.listen
    }

    if (typeof this.config.bmpPort === 'number') {
      const server = http.createServer((req, res) => {
        res.end(WELCOME_TEXT)
      })
      promises.push(new Promise(resolve => server.listen(this.config.bmpPort, resolve(server))).then(server => {
        this._startBmp(server)
        return server
      }))
    }
    return Promise.all(promises)
  },

  _startBmp (server) {
    // console.log('starting bmp', server)
    return Bmp.makeBmpPlugin(server).then(plugin => {
      this.onPlugin(plugin, Buffer.from([
        0, 0, 0, 0,
        0, 0, 0, 1
      ]))
    })
  },

  start () {
    return this.getServers().then(servers => {
      console.log('got servers!', servers)
      this.serversToClose = servers
      if (servers.length) {
        // SERVER_THAT_GETS_TO_SERVE_BTP = 0
        this.wss = new WebSocket.Server({ server: servers[SERVER_THAT_GETS_TO_SERVE_BTP] })
        this.serversToClose.push(this.wss)
        this.wss.on('connection', (ws, httpReq) => {
          console.log('ws connectoin!', httpReq.url)
          const parts = httpReq.url.split('/')
          pluginMaker(parts[URL_PATH_PART_VERSION], {
            name: parts[URL_PATH_PART_NAME],
            token: parts[URL_PATH_PART_TOKEN],
            socket: ws,
            initialBalancePerPeer: this.config.initialBalancePerPeer,
            baseLedger: this.config.baseLedger,
            authCheck: this.config.authCheck
          }).then(plugin => {
            if (!plugin) {
              ws.send('URL path not supported, try /api/17q3/user/pass or /api/17q4')
              ws.close()
              return
            }
            return plugin.connect().then(() => {
              this.onPlugin(plugin, Buffer.from([ 0, 0, 0, 0, 0, 0, 0, 1]))
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
