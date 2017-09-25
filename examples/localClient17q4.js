const Plugin = require('ilp-plugin-payment-channel-framework')

const localClient = new Plugin({
  btpUri: 'btp+ws://localClient:asdf@localhost:8000/api/17q4'
})

localClient.connect()
setTimeout(() => {
  console.log('5 seconds passed, closing client again!')
  localClient.disconnect()
}, 5000)
