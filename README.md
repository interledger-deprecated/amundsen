# amundsen
Bootstrap node for the Interledger Testnet of Testnets

It has a number of plugins for on-ledger escrow, and uses a btp plugin factory to create
plugin-virtual instances when a client connects.

```sh
$ ssh root@amundsen.michielbdejong.com # Ask Michiel, Evan, Dennis, Ben, or Stefan for access in https://gitter.im/interledger/testnet-of-testnets
>$ history # Always a good idea when ssh-ing into a server you which didn't configure yourself! :)
>$ cd amundsen
>$ docker build --tag amundsen .
>$ docker run -it -v /root/amundsen/src:/app/src -v /root/ilp-node/letsencrypt:/root/letsencrypt --net=host amundsen /bin/bash
>>$ npm start
```
