const { Spider, Cat } = require('btp-toolbox')

const localClient = new Spider({
  name: 'localClient',
  upstreams: [
    {
      url: 'ws://localhost:8000/api/17q3',
      token: 'asdf'
    }
  ]
}, (peerId) => {
  console.log(`connected to ${peerId}`)
}, (obj, peerId) => {
  console.log(`client sees BTP packet from ${peerId}`, Cat(obj))
})

localClient.start()
setTimeout(() => {
  console.log('5 seconds passed, closing client again!')
  localClient.stop()
}, 5000)
