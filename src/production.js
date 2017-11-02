const TestnetNode = require('./index')

const testnetNode = new TestnetNode({
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
    prefix: 'test.crypto.eth.rinkeby.',
    rate: Buffer.from([ 207, 65, 112, 139 ]) // 207 * (256*256*256) + 65 * (256*256) + 112 * (256) + 139 = 3477172363 = 3.4 * 10^9 Wei = 3.4 * 10^-9 ETH = 1 / 287590000 ETH = 1 micro USD
  },
  xrp: {
    secret: 'shvKKDpRGMyKMUVn4EyMqCh9BQoP9',
    account: 'rhjRdyVNcaTNLXp3rkK4KtjCdUd9YEgrPs',
    server: 'wss://s.altnet.rippletest.net:51233',
    prefix: 'test.crypto.xrp.',
    rate: Buffer.from([ 0, 0, 0, 5 ]) // 5 drops = 0.000005 XRP = 1/200000 XRP = 1 micro USD
  }
})

// Side effects of including this module:
testnetNode.start()
