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

## Ways to interact with Amundsen

Amundsen can perform several tricks, and each of them can be accessed via one of more of its API interfaces:


task                             || 17Q2 || 17Q3-BTP | 17Q3-ETH | 17Q3-XRP || 17Q4-BTP | 17Q4-ETH | 17Q4-XRP || 18Q1-BTP | 18Q1-http | 18Q1-OER |
---------------------------------||------||----------|----------|----------||----------|----------|----------||----------|-----------|----------|
get a quote for a quoted payment || YES  ||          |          |          ||          |          |          ||          |           |          |
vouch for an on-ledger address   ||      ||          |          |          ||          |          |          ||          |           |          |
send a quoted payment            || YES  ||          |          |          ||          |          |          ||          |           |          |
send a best-effort payment       ||      ||          |          |          ||          |          |          ||          |           |          |
announce a ledger prefix         || YES  ||          |          |          ||          |          |          ||          |           |          |
get your account's ILP address   ||      ||          |          |          ||          |          |          ||          |           |          |
get your account's unit of value ||      ||          |          |          ||          |          |          ||          |           |          |
get your account's min balance   ||      ||          |          |          ||          |          |          ||          |           |          |
get your account's current balance||     ||          |          |          ||          |          |          ||          |           |          |
get your account's max balance   || YES  ||          |          |          ||          |          |          ||          |           |          |
get API end-point information    || YES  ||          |          |          ||          |          |          ||          |           |          |

