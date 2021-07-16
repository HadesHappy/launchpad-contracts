# IDIA Launchpad Staking Contracts

In this repo, we will feature a new IDIA staking launchpad mechanism.

For documentation on our launchpad logic, please visit here:
https://docs.impossible.finance/launchpad/smart-contracts

## Setup

```
yarn install
```

## Test

```
npx hardhat test
```

## Deploy

### Deploy commands

```
# test tokens
npx hardhat run ./scripts/deploy-TestToken.ts --network bsc_test

# allocation master
npx hardhat run ./scripts/deploy-IFAllocationMaster.ts --network bsc_test

# allocation sale
SELLER=0xABCD PAY_TOKEN=0xABCD SALE_TOKEN=0xABCD ALLOCATION_MASTER=0xABCD TRACK_ID=123 SNAP_BLOCK=123456 START_BLOCK=123456 END_BLOCK=123456 SALE_PRICE=100000000000000000000 MAX_TOTAL_DEPOSIT=10000000000000000000000 npx hardhat run ./scripts/deploy-IFAllocationSale.ts --network bsc_test
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
TOKEN=0x... TO=0x... AMOUNT=10000000000000000000000 npx hardhat run ./scripts/send-TestToken.ts --network bsc_test
```

### Adding an allocation master track

```
ALLOCATION_MASTER=0xABCD TRACK_NAME='Track Name' TOKEN=0xABCD ACCRUAL_RATE=1000 PASSIVE_RO_RATE=100000000000000000 ACTIVE_RO_RATE=200000000000000000 npx hardhat run ./scripts/addTrack-IFAllocationMaster.ts --network bsc_test
```

### Funding an allocation sale

```
SALE=0xABCD AMOUNT=10000000000000000000000 npx hardhat run ./scripts/fund-IFAllocationSale.ts --network bsc_test
```

### Setting whitelist on allocation sale

```
SALE=0xABCD WHITELIST=0xABCD,0xBCDE,0xCDEF, npx hardhat run ./scripts/setWhitelist-IFAllocationSale.ts --network bsc_test
```

Note: whitelist passed in as comma separated list (end comma optional). No space allowed after comma.
