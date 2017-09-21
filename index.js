const IlpNode = require('ilp-node')

// ...
const ilpNode = new IlpNode({
  btp: {
    tls: 'amundsen.michielbdejong.com',
    path: '/ilp-node-3/api/v1',
    name: 'ab833ece33938b2327b0d7ab78a28a39c498c9915e8ab05026d5400f0fa2da34',
    initialBalancePerPeer: 10000,
    upstreams: []
  },
//  eth: {
//    secret: 'xidaequeequuu4xah8Ohnoo1Aesumiech6tiay1h',
//    account: '0x' + 'fa5b9836c46b6559be750b2f3c12657081fab858'.toUpperCase(),
//    provider: 'http://localhost:8545',
//    contract: '0x8B3FBD781096B51E68448C6E5B53B240F663199F',
//    prefix: 'test.crypto.eth.rinkeby.'
//  },
  xrp: {
    secret: 'shvKKDpRGMyKMUVn4EyMqCh9BQoP9',
    account: 'rhjRdyVNcaTNLXp3rkK4KtjCdUd9YEgrPs',
    server: 'wss://s.altnet.rippletest.net:51233',
    prefix: 'test.crypto.xrp.'
  }
})
ilpNode.start().then(() => {
  console.log('started', config)
})
