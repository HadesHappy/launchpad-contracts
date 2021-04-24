# iSTAX Insurance Contracts repo


### yarn install

### yarn compile

### yarn migrate


In this repo, we will feature a new iSTAX token, a new iSTAX staking mechanism whereby users will be able to deposit any LPTokens from our future swaps, as well as iSTAX and STAX staking to earn new iSTAX rewards.

For a full write up on our insurance plans, iSTAX tokenomics, please visit (to be published to Medium later):
https://docs.google.com/document/d/1tS28BwJYZkF4blpnlQGCSqNeQXEz7OmNAoJbQTm9t0c/edit


Table of Contents:

Libraries:
Address.sol,
Context.sol,
ERC20.sol,
EnumerableSet.sol,
IERC20.sol,
Ownable.sol,
SafeERC20.sol,
SafeMath.sol

Please deploy the remaining contracts in the following order

StaxToken.sol: STAX Original Token, unedited, will not be redeployed on mainnet, only for testnet purposes. 

iStaxToken.sol: the new iSTAX insurance BEP20 Token, fork of the StaxToken with cosmetic name changes. The owner of iStaxToken.sol will need to be set to the iStaxIssuer.sol which will create the new iSTAX Yield farming.

iStaxIssuer.sol: The fork of the (stax Superchef.sol) Sushichef Masterchef contract, similar to https://bscscan.com/address/0xc80991f9106e26e43bf1c07c764829a85f294c71#writeContract for STAX SuperChef.
Will be used to yield farm iSTAX. 

Key changes in this contract include:

- modifying to distribute iSTAX token instead of STAX token
- modify the calculation of getMultiplier() to support a scheduled halving decay of issuance of tokens, rather than just one bonus
- added a MiniStaxPerBlock, which is minimum distribution per block to prevent decay from going below 1
- the decay schedule is determined by the retooled variables: startBlock, firstBonusEndBlock, halvingDuration.

iSTAX, or other liquid tokens can be staked directly in the iSTAX issuer for liquid, no-lock pools.
The following are for locked, duration pools:

For each campaign that requires a fixed duration, a corresponding pool will need to be created in the iStaxIssuer, then a corresponding insurance/fixed-staking market pool deposit contract needs to be created: either for STAX fixed-length staking or iSTAX fixed-duration coverage staking.
Campaign tokens

StaxFixedStaking.sol: for staking of STAX tokens to earn iSTAX. Need to fix to distribute accrued iSTAX rewards
iStaxMarket.sol: for using up iSTAX token to purchase coverage in staking, where the multisig will add STAX tokens to pay out users in case of a covered event; otherwise, allow half of the collected iSTAX to be burnt and 

Each of these contracts take in a cosmetic token (stakingToken) that is used to lock inside the iStaxIssuer (SuperChef) which only the creator has. The creator must send the owner of this cosmetic stakingToken to 0x000 to prevent future minting and any abuse of this in order for the staking contracts to work. 

Thus, we need to first deploy a corresponding market or staking Token before deploying the pool contract above.

The two types of cosmetic tokens are:

iStaxMarketToken.sol: insurance market campaigns

StaxStakingToken.sol: staking market campaigns


These should only be deposited by the owner of the pools into the pools - these tokens are not distributed to anyone, but they are used to make it easier to onchain label the different markets/fixed staking terms that are launched, by naming the iStaxMarketToken & StaxStakingToken with what they are staked for and their duration/term length, etc. (STAX2W staking, or iSTAXDAIUP210331)

Finally, we also included this stax distributor, which will replace our current stax superchef contract.

StaxDistributor.sol: a fork of the Original sushichef MasterChef contract which has been only modified to distribute STAX from the already minted control of the dev address, rather than mint new tokens. This will be used to distribute/vest STAX rewards in the future (will not be needed right away)


*************************************


<img src="https://github.com/stablexswapdev/insuranceRepo/raw/main/new_insurance_preview.png"> 

Front End available here: (work in progress)
https://github.com/stablexswapdev/insFrontend

In this repo, we build a staking-native insurance product with a multi-sig enforcable resolution of the prediction market-style insurance product.

We essentially modified our old fixed-duration staking contracts to create contracts for binary outcome prediction markets. 
Users are able to earn iSTAX tokens through a liquidity mining mechanism for depositing liquidity into the core stablexswap, and then my proceed to allocate these iSTAX tokens to any of the eligible insurance market outcomes. For example, a user worried about smart contract risk can stake into the SWAPSC market, which pays out 1 STAX for every iSTAX staked in to it if the contract indeed gets exploited. 
On the backend, the smart contract has a fundStax function that allows a multisig such as the community treasury to send in STAX to provide liquidity in case of hack.

We can also do other binary markets such as StableXSwap reaching at least 4/6 of its items on its roadmap for the end of 2020! 
The possibilities are endless. 


-
v0.5 - deployed on bsc testnet
Stax Token
0xB9903d297F92b813b8198Ef80Fc41632BEbDdDab
iSTAX token
0xAE69d3ff1352bb8c406AfFAd9dCEC0b44dd72275

iStaxIssuer 0x55F88F68Aa3fb0148e5BbED29F2aef196011CF8E 
 deployed  with following constructor:
{_ISTAX:
0x29f5b2959c1b0FE96985799Bd2E6c36187A16Ff1,
_DEVADDR:
0x7323B13669028780c6450A620064E30654a5Be2c,
_ISTAXPERBLOCK:
8,
_MINISTAXPERBLOCK:
1,
_STARTBLOCK:
4724500,
_FIRSTBONUSENDBLOCK:
5724500,
_HALVINGDURATION:
1000000}


iStaxMarketToken: 0x74DEbF4cBE6A9dA18D89b0C2825Fac080076891B
iStaxMarket for DAIUP Insurance March 31 2021: 
0xd7E7057518cE02879ab0d1603DB119Bd3c466d20

insuranceMarkets added to the iStax issuer with 0 pool weight.

StaxFixedStaking.sol and corresponding StaxStakingToken.sol will be used for fixed-term stax pools that will be used in iSTAX issuer to earn iSTAX. 


----


v0: earlier versions of these contracts were deployed on testnet:
StaxToken
0x869446a92293DE6cEbb1b71CfcA6bd48f6bef6fC

iStaxToken
0x29f5b2959c1b0FE96985799Bd2E6c36187A16Ff1

IStaxIssuer
0xF6086E6f4272032B463fcA37c9C74568e58cA85C

ISTAXMarketToken Contracts
0x128CD4C86b64b62a360c5bb0d52AA3F932b17337,
0x9944bbB265661304c25B1b5aDd13d86adB470C11,
0x4492544060C5Ec18E0E6a744B666bcE3D8FF260E,
0x4492544060C5Ec18E0E6a744B666bcE3D8FF260E,
0xb0E38B2569220F5E33eBFF6E6D1Bff28914AaAc6,
0x91242B317F5791574AE617513A2c580c09Bb9C39

ISTAXMarket Contracts
0x2e19c7f6131Bf3d6fb15efF18c1CDC2f2Ee437dc,
0x5a7b1Feb1A9EB1623C8e5b6E264BDf6566c0eDDA,
0x258f24C7A4a4feE9914b3B491B35A906dEB6CC60,
0x81a23af0DbA6A5D949Ed39D48a2351D2012f3704,
0x97EA061ac2Ee2f1E7B76282Fd5257E5cF900C82A,
0x8A3Bf6e901B7Ed8f5d674378aeE4be5aaa2DEDa5,
0x7E0B639B81375788c681a2054BD8d9C9ce804f20
