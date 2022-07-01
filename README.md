# IDIA Launchpad Staking Contracts

In this repo, we will feature a new IDIA staking launchpad mechanism.

For documentation on our launchpad logic, please visit here:
https://docs.impossible.finance/launchpad/smart-contracts

## Setup

```
yarn install
```

## Test

### Running all tests
```
npx hardhat test
```

### Running specific tests
```
npx hardhat test --grep "<YOUR TARGET TESTS KEYWORD>"
```

### Inspect transactions on ethernal

Make sure ethernal is installed: https://doc.tryethernal.com/getting-started/quickstart

Spin up local node
```
npx hardhat node --fork <NODE RPC URL>
```

Turn on ethernal listener
```
ethernal listen
```

Import ethernal to the test script
```typescript
import 'hardhat-ethernal'
```

Run test case with ethernal credentials. Connect it to local node.
```
ETHERNAL_EMAIL=<YOUR EMAIL> ETHERNAL_PASSWORD=<YOUR PASSWORD> npx hardhat run <FILE PATH> --network localhost
```

Login and browse the transactions at https://app.tryethernal.com


## Deploy

### Deploy commands

```
# allocation master
npx hardhat run ./scripts/IFAllocationMaster-deploy.ts --network bsc_test

# allocation sale
SELLER=0xABCD PAY_TOKEN=0xABCD SALE_TOKEN=0xABCD ALLOCATION_MASTER=0xABCD TRACK_ID=123 SNAP_BLOCK=123456 START_BLOCK=123456 END_BLOCK=123456 SALE_PRICE=100000000000000000000 MAX_TOTAL_PAYMENT=10000000000000000000000 npx hardhat run ./scripts/IFAllocationSale-deploy.ts --network bsc_test

# vIDIA
NAME=VIDIA SYMBOL=VIDIA ADMIN=0xABCD UNDERLYING=0xABCD npx hardhat run ./scripts/VIDIA-deploy.ts --network bsc_test

# Verify vIDIA
npx hardhat verify --network bsc_test <DEPLOYED_CONTRACT_ADDRESS> "VIDIA" "VIDIA" "<ADMIN_ADDRESS>" "<UNDERLYING_ADDRESS>"
```

### Production

For production, the deploy command is similar to the one for testnet but you must change the network to `bsc_main`.

You also must add a account / mnemonic in a file named `.env` in the root of the repo with the contents:

```
MAINNET_MNEMONIC='example example example example...'
```

## Other utilities

### Sending tokens

```
TOKEN=0x... TO=0x... AMOUNT=10000000000000000000000 npx hardhat run ./scripts/GenericToken-send.ts --network bsc_test
```

### Pausing and unpausing a pausable token

```
# pause
TOKEN=0x... npx hardhat run ./scripts/GenericToken-pause.ts --network bsc_test

# unpause
TOKEN=0x... npx hardhat run ./scripts/GenericToken-unpause.ts --network bsc_test
```

### Deploying a standard mintable pausable token

```
NAME='Token Name' SYMBOL='TKN1' INIT_SUPPLY=... npx hardhat run ./scripts/GenericToken-deploy.ts --network bsc_test
```

### Minting token

```
TOKEN=0x... TO=0x... AMOUNT=... npx hardhat run ./scripts/GenericToken-mint.ts --network bsc_test
```

### Adding an allocation master track

```
ALLOCATION_MASTER=0xABCD TRACK_NAME='Track Name' TOKEN=0xABCD ACCRUAL_RATE=1000 PASSIVE_RO_RATE=100000000000000000 ACTIVE_RO_RATE=200000000000000000 MAX_TOTAL_STAKE=1000000000000000000000000 npx hardhat run ./scripts/IFAllocationMaster-addTrack.ts --network bsc_test
```

### Bumping sale counter on track

```
ALLOCATION_MASTER=0xABCD TRACK_ID=n npx hardhat run ./scripts/IFAllocationMaster-bumpSaleCounter.ts --network bsc_test
```

### Funding an allocation sale

```
SALE=0xABCD AMOUNT=10000000000000000000000 npx hardhat run ./scripts/IFAllocationSale-fund.ts --network bsc_test
```

### Setting whitelist on allocation sale

```
# via command line, for a short list
# Note: whitelist passed in as comma separated list (end comma optional). No space allowed after comma.
SALE=0xABCD WHITELIST=0xABCD,0xBCDE,0xCDEF, npx hardhat run ./scripts/IFAllocationSale-setWhitelist.ts --network bsc_test

# via file containing JSON list of address strings, for a long list
SALE=0xABCD WHITELIST_JSON_FILE=/path/to/addresses.json npx hardhat run ./scripts/IFAllocationSale-setWhitelist.ts --network bsc_test

# using optional second whitelist for intersection
SALE=0xABCD WHITELIST_JSON_FILE=/path/to/addresses.json WHITELIST_JSON_FILE_2=/path/to/addresses2.json npx hardhat run ./scripts/IFAllocationSale-setWhitelist.ts --network bsc_test
```

### Overriding Sale Token Allocation

```
SALE=0xABCD ALLOCATION=1000000000000000000000 npx hardhat run ./scripts/IFAllocationSale-setSaleTokenAllocationOverride.ts --network bsc_test
```

### Setting a delay for claim

```
SALE=0xABCD DELAY=100 npx hardhat run ./scripts/IFAllocationSale-setWithdrawDelay.ts --network bsc_test
```

### Setting a casher

```
SALE=0xABCD CASHER=0xABCD npx hardhat run ./scripts/IFAllocationSale-setCasher.ts --network bsc_test
```

### Transfering ownership

```
SALE=0xABCD NEW_OWNER=0xABCD npx hardhat run ./scripts/IFAllocationSale-transferOwnership.ts --network bsc_test
```

### Cashing

```
SALE=0xABCD npx hardhat run ./scripts/IFAllocationSale-cash.ts --network bsc_test
```
