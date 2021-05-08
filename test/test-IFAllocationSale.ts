import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { getGasUsed, mineNext } from './helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'

export default describe('IF Allocation Sale', function () {
  // deployer address
  let owner: SignerWithAddress
  let buyer: SignerWithAddress
  let seller: SignerWithAddress

  // contract vars
  let StakeToken: Contract
  let PaymentToken: Contract
  let SaleToken: Contract
  let IFAllocationMaster: Contract
  let IFAllocationSale: Contract

  // allocation master vars
  let trackId: number

  // launchpad vars
  const salePrice = '10000000000000000000' // 10 PAY per SALE
  const snapshotBlock = 90 // block at which to take allocation snapshot
  const startBlock = 100 // start block of sale (inclusive)
  const endBlock = 200 // end block of sale (inclusive)
  const minDeposit = '250000000000000000000000' // min deposit
  const maxDeposit = '25000000000000000000000000' // max deposit

  // other vars
  const fundAmount = '33333'

  // setup for each test
  beforeEach(async () => {
    // get test accounts
    owner = (await ethers.getSigners())[0]
    buyer = (await ethers.getSigners())[1]
    seller = (await ethers.getSigners())[2]

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
      10, // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000' // active rollover rate (20%)
    )

    // get new track id
    mineNext()
    trackId = (await IFAllocationMaster.trackCount()) - 1

    // deploy launchpad
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
      minDeposit,
      maxDeposit
    )

    // fund sale
    mineNext()
    await SaleToken.connect(seller).approve(
      IFAllocationSale.address,
      fundAmount
    ) // approve
    await IFAllocationSale.connect(seller).fund(fundAmount) // fund

    // stake and accrue stake weight
    mineNext()
    const stakeAmount = '1000000000000000000'
    await StakeToken.connect(buyer).approve(
      IFAllocationMaster.address,
      stakeAmount
    ) // approve
    await IFAllocationMaster.connect(buyer).stake(trackId, stakeAmount) // stake

    // expect staked amount to match
    mineNext()
    expect(
      (await StakeToken.balanceOf(IFAllocationMaster.address)).toString()
    ).to.equal(stakeAmount)
  })

  it('can purchase', async function () {
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
    expect((await getGasUsed()).toString()).to.equal('180292')

    // fast forward blocks to get to end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdraw
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()

    // gas used in withdraw
    expect((await getGasUsed()).toString()).to.equal('54387')

    // expect balance to increase by fund amount
    expect(await SaleToken.balanceOf(buyer.address)).to.equal(fundAmount)
  })
})
