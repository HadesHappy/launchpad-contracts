import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { getGasUsed, mineNext } from './helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'
import {
  computeMerkleRoot,
  computeMerkleProof,
  getAddressIndex,
} from '../library/merkleWhitelist'

export default describe('IF Allocation Sale', function () {
  // deployer address
  let owner: SignerWithAddress
  let buyer: SignerWithAddress
  let buyer2: SignerWithAddress
  let seller: SignerWithAddress
  let casher: SignerWithAddress

  // contract vars
  let StakeToken: Contract
  let PaymentToken: Contract
  let SaleToken: Contract
  let IFAllocationMaster: Contract
  let IFAllocationSale: Contract

  // allocation master vars
  let trackId: number

  // sale contract vars
  let snapshotBlock: number // block at which to take allocation snapshot
  let startBlock: number // start block of sale (inclusive)
  let endBlock: number // end block of sale (inclusive)
  const salePrice = '10000000000000000000' // 10 PAY per SALE
  const maxTotalDeposit = '25000000000000000000000000' // max deposit
  // other vars
  // const fundAmount = '33333'
  const fundAmount = '1000000000'

  // setup for each test
  beforeEach(async () => {
    // set launchpad blocks in future
    mineNext()
    const currBlock = await ethers.provider.getBlockNumber()
    mineNext()
    snapshotBlock = currBlock + 90
    startBlock = currBlock + 100
    endBlock = currBlock + 200

    // get test accounts
    owner = (await ethers.getSigners())[0]
    buyer = (await ethers.getSigners())[1]
    seller = (await ethers.getSigners())[2]
    casher = (await ethers.getSigners())[3]
    buyer2 = (await ethers.getSigners())[4]

    // deploy test tokens
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    StakeToken = await TestTokenFactory.connect(buyer).deploy(
      'Test Stake Token',
      'STAKE',
      '21000000000000000000000000' // 21 million * 10**18
    )
    PaymentToken = await TestTokenFactory.connect(buyer).deploy(
      'Test Payment Token',
      'PAY',
      '21000000000000000000000000' // 21 million * 10**18
    )
    SaleToken = await TestTokenFactory.connect(seller).deploy(
      'Test Sale Token',
      'SALE',
      '21000000000000000000000000' // 21 million * 10**18
    )

    // redistribute tokens
    mineNext()
    StakeToken.connect(buyer).transfer(
      buyer2.address,
      '1000000000000000000000000'
    )
    PaymentToken.connect(buyer).transfer(
      buyer2.address,
      '1000000000000000000000000'
    )

    // deploy allocation master
    const IFAllocationMasterFactory = await ethers.getContractFactory(
      'IFAllocationMaster'
    )
    IFAllocationMaster = await IFAllocationMasterFactory.deploy()

    // add track on allocation master
    mineNext()
    mineNext()
    await IFAllocationMaster.addTrack(
      'IDIA track', // name
      StakeToken.address, // stake token
      10000, // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000' // active rollover rate (20%)
    )

    // get new track id
    mineNext()
    trackId = (await IFAllocationMaster.trackCount()) - 1

    // deploy sale
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    IFAllocationSale = await IFAllocationSaleFactory.deploy(
      salePrice,
      seller.address,
      PaymentToken.address,
      SaleToken.address,
      IFAllocationMaster.address,
      trackId,
      snapshotBlock,
      startBlock,
      endBlock,
      maxTotalDeposit
    )
    mineNext()

    // set the casher address
    await IFAllocationSale.setCasher(casher.address)
    mineNext()

    // fund sale
    mineNext()
    await SaleToken.connect(seller).approve(
      IFAllocationSale.address,
      fundAmount
    ) // approve
    await IFAllocationSale.connect(seller).fund(fundAmount) // fund

    // stake and accrue stake weight
    mineNext()
    const stakeAmount = 100000000000000
    // buyer 1
    await StakeToken.connect(buyer).approve(
      IFAllocationMaster.address,
      stakeAmount
    ) // approve
    await IFAllocationMaster.connect(buyer).stake(trackId, stakeAmount) // stake
    // buyer 2
    await StakeToken.connect(buyer2).approve(
      IFAllocationMaster.address,
      stakeAmount
    ) // approve
    await IFAllocationMaster.connect(buyer2).stake(trackId, stakeAmount) // stake

    // expect staked amount to match
    mineNext()
    expect(
      (await StakeToken.balanceOf(IFAllocationMaster.address)).toString()
    ).to.equal((stakeAmount * 2).toString())
  })

  it('can purchase, withdraw, and cash', async function () {
    mineNext()

    // amount to pay
    const paymentAmount = '333330'

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // test purchase
    mineNext()
    await PaymentToken.connect(buyer).approve(
      IFAllocationSale.address,
      paymentAmount
    )
    await IFAllocationSale.connect(buyer).purchase(paymentAmount)

    mineNext()

    // gas used in purchase
    expect((await getGasUsed()).toString()).to.equal('213692')

    // fast forward blocks to get after the end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdraw
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()

    // gas used in withdraw
    expect((await getGasUsed()).toString()).to.equal('102497')

    // expect balance to increase by fund amount
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('33333')

    // test repeated withdraw (should fail)
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()

    // expect balance to remain the same
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('33333')

    // test cash
    await IFAllocationSale.connect(casher).cash()
    mineNext()

    // expect balance to increase by cash amount
    expect(await PaymentToken.balanceOf(casher.address)).to.equal(paymentAmount)

    // test purchaser counter
    expect(await IFAllocationSale.purchaserCount()).to.equal(1)

    // test withdrawer counter
    expect(await IFAllocationSale.withdrawerCount()).to.equal(1)
  })

  it('can whitelist purchase', async function () {
    mineNext()

    // whitelisted addresses (sorted)
    const addresses = (await ethers.getSigners())
      .map((s) => s.address.toLowerCase())
      .sort()

    // get merkle root
    const merkleRoot = computeMerkleRoot(addresses)

    // add whitelist merkleroot to sale
    await IFAllocationSale.setWhitelist(merkleRoot)
    mineNext()

    // test checking whitelist
    const account = buyer
    const acctIdx = getAddressIndex(addresses, account.address)
    expect(
      await IFAllocationSale.connect(account).checkWhitelist(
        computeMerkleProof(addresses, acctIdx)
      )
    ).to.equal(true)

    // amount to pay
    const paymentAmount = '333330'

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // test whitelist purchase
    mineNext()
    await PaymentToken.connect(account).approve(
      IFAllocationSale.address,
      paymentAmount
    )
    await IFAllocationSale.connect(account).whitelistedPurchase(
      paymentAmount,
      computeMerkleProof(addresses, acctIdx)
    )

    mineNext()

    // fast forward blocks to get after the end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdraw
    mineNext()
    await IFAllocationSale.connect(account).withdraw()
    mineNext()

    // expect balance to increase by fund amount
    expect(await SaleToken.balanceOf(account.address)).to.equal('33333')

    // test purchaser counter
    expect(await IFAllocationSale.purchaserCount()).to.equal(1)

    // test withdrawer counter
    expect(await IFAllocationSale.withdrawerCount()).to.equal(1)
  })

  it('can override sale token allocations (test preventing exceeding allocation)', async function () {
    mineNext()

    // amount to pay (should fail, because this is 1 over allocation)
    const paymentAmount = '100001'

    // set sale token allocation override
    await IFAllocationSale.setSaleTokenAllocationOverride(10000)
    mineNext()

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // test purchase
    mineNext()
    await PaymentToken.connect(buyer).approve(
      IFAllocationSale.address,
      paymentAmount
    )
    await IFAllocationSale.connect(buyer).purchase(paymentAmount)

    mineNext()

    // fast forward blocks to get after the end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdraw
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()

    // expect balance to be 0
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('0')
  })

  it('can override sale token allocations (test multiple buyers)', async function () {
    mineNext()

    // amount to pay for each claimer (should go through since this is exactly how much allocation they have)
    const paymentAmount = '50000'

    // set sale token allocation override
    await IFAllocationSale.setSaleTokenAllocationOverride(5000)
    mineNext()

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // test purchase for buyers 1 and 2
    mineNext()
    await PaymentToken.connect(buyer).approve(
      IFAllocationSale.address,
      paymentAmount
    )
    await IFAllocationSale.connect(buyer).purchase(paymentAmount)

    mineNext()
    await PaymentToken.connect(buyer2).approve(
      IFAllocationSale.address,
      paymentAmount
    )
    await IFAllocationSale.connect(buyer2).purchase(paymentAmount)

    mineNext()

    // fast forward blocks to get after the end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdraw
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()
    await IFAllocationSale.connect(buyer2).withdraw()
    mineNext()

    // expect balance to be 5000 for both buyers
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('5000')
    expect(await SaleToken.balanceOf(buyer2.address)).to.equal('5000')

    // test purchaser counter
    expect(await IFAllocationSale.purchaserCount()).to.equal(2)

    // test withdrawer counter
    expect(await IFAllocationSale.withdrawerCount()).to.equal(2)
  })

  it('can perform a zero price giveaway sale (unwhitelisted / first come first serve)', async function () {
    mineNext()

    // here set up a new IFAllocationSale with salePrice of 0, because
    // provided fixture sale does not have salePrice set to 0

    // deploy 0 price allocation sale
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    IFAllocationSale = await IFAllocationSaleFactory.deploy(
      0, // sale price
      seller.address,
      PaymentToken.address, // doesn't matter
      SaleToken.address,
      IFAllocationMaster.address, // doesn't matter
      trackId, // doesn't matter
      snapshotBlock, // doesn't matter
      startBlock, // doesn't matter
      endBlock, // doesn't matter
      maxTotalDeposit // doesn't matter
    )
    mineNext()

    // fund sale
    mineNext()
    await SaleToken.connect(seller).approve(
      IFAllocationSale.address,
      fundAmount
    ) // approve
    await IFAllocationSale.connect(seller).fund(fundAmount) // fund

    // set sale token allocation override (flat amount every participant receives)
    await IFAllocationSale.setSaleTokenAllocationOverride(5000)
    mineNext()

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // nothing to do here

    // fast forward blocks to get after the end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test normal withdraw (should not go through, must go through withdrawGiveaway)
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()
    await IFAllocationSale.connect(buyer2).withdraw()
    mineNext()

    // expect balance to be 0 for both participants
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('0')
    expect(await SaleToken.balanceOf(buyer2.address)).to.equal('0')

    // test withdrawGiveaway (should go through)
    mineNext()
    await IFAllocationSale.connect(buyer).withdrawGiveaway([])
    mineNext()
    await IFAllocationSale.connect(buyer2).withdrawGiveaway([])
    mineNext()

    // expect balance to be 5000 for both participants
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('5000')
    expect(await SaleToken.balanceOf(buyer2.address)).to.equal('5000')

    // test purchaser counter (should be 0! nothing purchased in 0 price sales)
    // note: this is the only scenario where this is different from withdrawer counter
    expect(await IFAllocationSale.purchaserCount()).to.equal(0)

    // test withdrawer counter
    expect(await IFAllocationSale.withdrawerCount()).to.equal(2)
  })

  it('can perform a zero price giveaway sale (whitelisted)', async function () {
    mineNext()

    // here set up a new IFAllocationSale with salePrice of 0, because
    // provided fixture sale does not have salePrice set to 0

    // deploy 0 price allocation sale
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    IFAllocationSale = await IFAllocationSaleFactory.deploy(
      0, // sale price
      seller.address,
      PaymentToken.address, // doesn't matter
      SaleToken.address,
      IFAllocationMaster.address, // doesn't matter
      trackId, // doesn't matter
      snapshotBlock, // doesn't matter
      startBlock, // doesn't matter
      endBlock, // doesn't matter
      maxTotalDeposit // doesn't matter
    )
    mineNext()

    // fund sale
    mineNext()
    await SaleToken.connect(seller).approve(
      IFAllocationSale.address,
      fundAmount
    ) // approve
    await IFAllocationSale.connect(seller).fund(fundAmount) // fund

    // set sale token allocation override (flat amount every participant receives)
    await IFAllocationSale.setSaleTokenAllocationOverride(5000)
    mineNext()

    // whitelisted addresses (sorted)
    const addresses = (await ethers.getSigners())
      .map((s) => s.address.toLowerCase())
      .sort()

    // get merkle root
    const merkleRoot = computeMerkleRoot(addresses)

    // add whitelist merkleroot to sale
    await IFAllocationSale.setWhitelist(merkleRoot)
    mineNext()

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // nothing to do here

    // fast forward blocks to get after the end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdrawGiveaway without proof (should not go through)
    mineNext()
    await IFAllocationSale.connect(buyer).withdrawGiveaway([])
    mineNext()
    await IFAllocationSale.connect(buyer2).withdrawGiveaway([])
    mineNext()

    // expect balance to be 0 for both participants
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('0')
    expect(await SaleToken.balanceOf(buyer2.address)).to.equal('0')

    // test withdrawGiveaway with proof (should go through)
    mineNext()

    await IFAllocationSale.connect(buyer).withdrawGiveaway(
      computeMerkleProof(addresses, getAddressIndex(addresses, buyer.address))
    )
    mineNext()
    await IFAllocationSale.connect(buyer2).withdrawGiveaway(
      computeMerkleProof(addresses, getAddressIndex(addresses, buyer2.address))
    )
    mineNext()

    // expect balance to be 5000 for both participants
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('5000')
    expect(await SaleToken.balanceOf(buyer2.address)).to.equal('5000')
  })

  it('can set withdraw delay', async function () {
    mineNext()

    // delay of 10 blocks
    const delay = 10

    // add withdraw delay
    await IFAllocationSale.setWithdrawDelay(delay)
    mineNext()

    // amount to pay
    const paymentAmount = '333330'

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // test purchase
    mineNext()
    await PaymentToken.connect(buyer).approve(
      IFAllocationSale.address,
      paymentAmount
    )
    await IFAllocationSale.connect(buyer).purchase(paymentAmount)

    mineNext()

    // fast forward blocks to get to one short of end block + delay
    while ((await ethers.provider.getBlockNumber()) < endBlock + delay - 1) {
      mineNext()
    }

    // test withdraw and cash (should fail because need 1 more block)
    await IFAllocationSale.connect(buyer).withdraw()
    await IFAllocationSale.connect(casher).cash()

    mineNext()

    // fails
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('0')
    // fails
    expect(await PaymentToken.balanceOf(casher.address)).to.equal('0')

    // test withdraw and cash (should work here since 1 block has passed)
    await IFAllocationSale.connect(buyer).withdraw()
    await IFAllocationSale.connect(casher).cash()

    mineNext()

    // expect balance to increase by fund amount
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('33333')
    // expect balance to increase by cash amount
    expect(await PaymentToken.balanceOf(casher.address)).to.equal(paymentAmount)

    // test purchaser counter
    expect(await IFAllocationSale.purchaserCount()).to.equal(1)

    // test withdrawer counter
    expect(await IFAllocationSale.withdrawerCount()).to.equal(1)
  })
})
