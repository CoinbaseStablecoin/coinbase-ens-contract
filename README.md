# Coinbase Offchain Resolver

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
`CoinbaseResolver.test.ts` to learn more about how this works.

CoinbaseResolver conforms to [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)
and [EIP-1822](https://eips.ethereum.org/EIPS/eip-1822) for upgradeability.

## Usage

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

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Lint TypeScript

Lint the TypeScript code:

```sh
$ yarn lint:ts
```

### Test

Run the Mocha tests:

```sh
$ yarn test
```

## Deployment

```sh
$ hardhat typechain
$ hardhat deploy:CoinbaseResolver --network <NETWORK>
```
