# amundsen
Bootstrap node for the Interledger Testnet of Testnets

It has a number of plugins for on-ledger escrow, and uses a btp plugin factory to create
plugin-virtual instances when a client connects.

```sh
$ ssh root@amundsen.michielbdejong.com # Ask Michiel, Evan, Dennis, Ben, or Stefan for access in https://gitter.im/interledger/testnet-of-testnets
>$ history # Always a good idea when ssh-ing into a server you which didn't configure yourself! :)
>$ cd amundsen
>$ pm2 list
```

## Ways to interact with Amundsen

Amundsen can perform several tricks, and each of them can be accessed via one of more of its API interfaces:


Task                                                   | 17Q2 | 17Q3-BTP | 17Q3-ETH | 17Q3-XRP | 17Q4-BTP | 17Q4-ETH | 17Q4-XRP | 18Q1-BTP | 18Q1-HEAD | 18Q1-OER |
-------------------------------------------------------|------|----------|----------|----------|----------|----------|----------|----------|-----------|----------|
Send a payment with fixed destination amount           | YES  | YES      | YES      | YES      | YES      | YES      | YES      |          |           |          |
Send a payment with best-effort destination amount     |      | YES      | YES      | YES      | YES      | YES      | YES      | YES      | YES       | YES      |
Get a quote for a payment (ILQP)                       | YES  | YES      |          |          | YES      |          |          |          |           |          |
Vouch for an on-ledger address                         |      | YES      |          |          | YES      |          |          |          |           |          |
Announce a ledger prefix                               | YES  | YES      |          |          | YES      |          |          |          |           |          |
Get your account's ILP address                         |      | YES      |          |          | YES      |          |          | YES      | YES       | YES      |
Get your account's current balance                     |      | YES      |          |          | YES      |          |          | YES      | YES       | YES      |
Get your account's unit of value                       |      | YES      |          |          | YES      |          |          |          |           |          |
Get your account's min balance                         |      |          |          |          |          |          |          |          |           |          |
Get your account's max balance                         | YES  |          |          |          |          |          |          |          |           |          |
Get API end-point information                          | YES  |          |          |          |          |          |          |          |           |          |

