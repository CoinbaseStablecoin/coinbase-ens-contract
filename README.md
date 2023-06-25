# ENS Offchain Resolver

This repo was forked from
[Coinbase](https://github.com/CoinbaseStablecoin/coinbase-ens-contract). The
contract was renamed to `ENSResolver` to make it clear it is a generic ENS
resolver and not specific to Coinbase names.

```
Client                             Offchain Resolver Contract          Gateway
  |                    resolve(dnsname, lookup) |                         |
  |-------------------------------------------->|                         |
  |                                             |                         |
  | error: OffchainLookup(addr, url, data, ...) |                         |
  |<--------------------------------------------|                         |
  |                                             |                         |
  |                                             |      GET /{addr}/{data} |
  |---------------------------------------------------------------------->|
  |                                             |                         |
  | response: (result, expires, sig)            |                         |
  |<----------------------------------------------------------------------|
  |                                             |                         |
  |            resolveWithProof(response, data) |                         |
  |-------------------------------------------->|                         |
  |                                             |                         |
  | result (or an error if invalid)             |                         |
  |<--------------------------------------------|                         |
  |                                             |                         |
```

Please refer to the tests for `.resolve` and `.resolveWithProof` in
`ENSResolver.test.ts` to learn more about how this works.

## Requirements

- Node.js v16
- Yarn v1.22.x

## Usage

### Install dependencies

```sh
$ yarn install
```

### Compile

Compile the smart contracts with Hardhat:

```sh
$ yarn compile
```

### TypeChain

Compile the smart contracts and generate TypeChain artifacts:

```sh
$ yarn typechain
```

### Format

```sh
$ yarn prettier
```

### Lint

```sh
$ yarn lint
```

### Test

```sh
$ yarn test
```

### Test Coverage

Ensure test coverage is at 100%

```sh
$ yarn coverage

$ open coverage/index.html
```

### Deployment

```sh
$ yarn deploy --network <NETWORK>
```
