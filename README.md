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

### Testnet

```
# test tokens
npx hardhat run ./scripts/deploy-TestToken.ts --network bsc_test

# allocation master
npx hardhat run ./scripts/deploy-IFAllocationMaster.ts --network bsc_test

# allocation sale
SELLER=0xABCD PAY_TOKEN=0xABCD SALE_TOKEN=0xABCD ALLOCATION_MASTER=0xABCD TRACK_ID=123 SNAP_BLOCK=123456 START_BLOCK=123456 END_BLOCK=123456 SALE_PRICE=100000000000000000000 MAX_TOTAL_DEPOSIT=10000000000000000000000 npx hardhat run ./scripts/deploy-IFAllocationSale.ts --network bsc_test
```

### Production

For production, the deploy command is similar to the one for testnet but you must supply an account / mnemonic.
For obvious security reasons, this is not included in the hardhat config - this should be specified via
environment variable.

```
# test tokens
npx hardhat run ./scripts/deploy-TestToken.ts --network bsc_main

# allocation master
npx hardhat run ./scripts/deploy-IFAllocationMaster.ts --network bsc_main

# allocation sale
SELLER=0xABCD PAY_TOKEN=0xABCD SALE_TOKEN=0xABCD ALLOCATION_MASTER=0xABCD TRACK_ID=123 SNAP_BLOCK=123456 START_BLOCK=123456 END_BLOCK=123456 SALE_PRICE=100000000000000000000 MAX_TOTAL_DEPOSIT=10000000000000000000000 npx hardhat run ./scripts/deploy-IFAllocationSale.ts --network bsc_main
```

## Other utilities

### Sending tokens

```
TOKEN=0x... TO=0x... AMOUNT=10000000000000000000000 npx hardhat run ./scripts/send-TestToken.ts --network <bsc_main/bsc_test>
```

### Creating a track

```
ALLOCATION_MASTER=0xABCD TRACK_NAME='Track Name' TOKEN=0xABCD ACCRUAL_RATE=1000 PASSIVE_RO_RATE=100000000000000000 ACTIVE_RO_RATE=200000000000000000 npx hardhat run ./scripts/addTrack-IFAllocationMaster.ts --network <bsc_main/bsc_test>
```
