const PluginFactory = require('./pluginFactory')

// ...
const pluginFactory = new PluginFactory({
  listen: 8000,
  //  tls: 'amundsen.michielbdejong.com',
  initialBalancePerPeer: 10000,
  baseLedger: 'test.amundsen.'
}, {
  //  'test.crypto.eth.rinkeby.': {
  //    secret: 'xidaequeequuu4xah8Ohnoo1Aesumiech6tiay1h',
  //    account: '0x' + 'fa5b9836c46b6559be750b2f3c12657081fab858'.toUpperCase(),
  //    provider: 'http://localhost:8545',
  //    contract: '0x8B3FBD781096B51E68448C6E5B53B240F663199F',
  //    prefix: 'test.crypto.eth.rinkeby.'
  //  },
  'test.crypto.xrp.': {
    secret: 'shvKKDpRGMyKMUVn4EyMqCh9BQoP9',
    account: 'rhjRdyVNcaTNLXp3rkK4KtjCdUd9YEgrPs',
    server: 'wss://s.altnet.rippletest.net:51233',
    prefix: 'test.crypto.xrp.'
  }
})
pluginFactory.start().then(() => {
  console.log('started')
})
