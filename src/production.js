const TestnetNode = require('./index')
const fetch = require('node-fetch')
const uint64be = require('uint64be')

const COINMARKETCAP_API = 'https://api.coinmarketcap.com/v1/ticker/'

let config = {
  btp: {
    tls: 'amundsen.michielbdejong.com',
    initialBalancePerPeer: 10000,
    baseLedger: 'test.amundsen.',
    authCheck: function (username, token) {
      return true
    }
  },
  eth: {
    secret: 'xidaequeequuu4xah8Ohnoo1Aesumiech6tiay1h',
    account: '0x' + 'fa5b9836c46b6559be750b2f3c12657081fab858'.toUpperCase(),
    provider: 'http://localhost:8545',
    contract: '0x8B3FBD781096B51E68448C6E5B53B240F663199F',
    prefix: 'test.crypto.eth.rinkeby.'
    // rate to be added by getRates()
  },
  xrp: {
    secret: 'shvKKDpRGMyKMUVn4EyMqCh9BQoP9',
    account: 'rhjRdyVNcaTNLXp3rkK4KtjCdUd9YEgrPs',
    server: 'wss://s.altnet.rippletest.net:51233',
    prefix: 'test.crypto.xrp.'
    // rate to be added by getRates()
  },
  bmp: {
    port: 1801
  }
}

function getRates() {
  return fetch(COINMARKETCAP_API).then(res => {
    return res.json()
  }).then(arr => {
    arr.map(item => {
      if (item.symbol === 'ETH') {
        const microUsdPerBaseUnit = item.price_usd * Math.pow(10, -12)  // multiply by 10^6 for micro-USD, then divide again by 10^18 because 10^18 per ETH
        config.eth.rate = uint64be.encode(Math.round(1 / microUsdPerBaseUnit))
        console.log('eth rate (in Wei per micro-USD)', config.eth.rate)
      }
      if (item.symbol === 'XRP') {
        const microUsdPerBaseUnit = item.price_usd // multiply by 10^6 for micro-USD, then divide again by 10^6 because 10^6 Drop per XRP
        config.xrp.rate = uint64be.encode(Math.round(1 / microUsdPerBaseUnit))
        console.log('xrp rate (in Drops per micro-USD)', config.xrp.rate)
      }
    })
  })
}

// Side effects of including this module:
getRates().then(() => {
 const testnetNode = new TestnetNode(config)
 return testnetNode.start()
})
