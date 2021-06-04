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

  // launchpad vars
  const salePrice = '10000000000000000000' // 10 PAY per SALE
  const snapshotBlock = 90 // block at which to take allocation snapshot
  const startBlock = 100 // start block of sale (inclusive)
  const endBlock = 200 // end block of sale (inclusive)
  const maxTotalDeposit = '25000000000000000000000000' // max deposit

  // other vars
  // const fundAmount = '33333'
  const fundAmount = '1000000000'

  // setup for each test
  beforeEach(async () => {
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
    StakeToken.connect(buyer).transfer(buyer2.address, '1000000000000000000')

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
      maxTotalDeposit
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
    expect((await getGasUsed()).toString()).to.equal('187021')

    // fast forward blocks to get to end block
    while ((await ethers.provider.getBlockNumber()) <= endBlock) {
      mineNext()
    }

    // test withdraw
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()

    // gas used in withdraw
    expect((await getGasUsed()).toString()).to.equal('94283')

    // expect balance to increase by fund amount
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('33333')

    // test repeated withdraw (should fail)
    mineNext()
    await IFAllocationSale.connect(buyer).withdraw()
    mineNext()

    // expect balance to remain the same
    expect(await SaleToken.balanceOf(buyer.address)).to.equal('33333')

    // test cash
    // set the casher address
    await IFAllocationSale.setCasher(casher.address)
    mineNext()

    // attempt cashing
    await IFAllocationSale.connect(casher).cash()
    mineNext()

    // expect balance to increase by cash amount
    expect(await PaymentToken.balanceOf(casher.address)).to.equal(paymentAmount)

    //// test whitelisting

    // // whitelisted addresses (sorted)
    // const addresses = (await ethers.getSigners()).map((s) => s.address).sort()

    // // get merkle root
    // const merkleRoot = computeMerkleRoot(addresses)

    // // add whitelist merkleroot to sale
    // await IFAllocationSale.setWhitelist(merkleRoot)
    // mineNext()

    // // test checking whitelist
    // const account = casher
    // const acctIdx = getAddressIndex(addresses, account.address)
    // expect(
    //   await IFAllocationSale.connect(account).checkWhitelist(
    //     acctIdx,
    //     computeMerkleProof(addresses, acctIdx)
    //   )
    // ).to.equal(true)
  })
})
