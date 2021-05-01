import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { mineNext } from './helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from '@ethersproject/contracts'

export default describe('IF Allocation Sale', function () {
  // vars for all tests
  let owner: SignerWithAddress
  let PaymentToken: Contract
  let SaleToken: Contract
  let IFAllocationMaster: Contract
  let IFAllocationSale: Contract

  // launchpad parameters
  const salePrice = '10000000000000000000' // 10 PAY per SALE
  const snapshotBlock = 20 // block at which to take allocation snapshot
  const startBlock = 100 // start block of sale (inclusive)
  const endBlock = 200 // end block of sale (inclusive)
  const minDeposit = '250000000000000000000000' // min deposit
  const maxDeposit = '25000000000000000000000000' // max deposit

  // setup for each test
  beforeEach(async () => {
    // get owner
    owner = (await ethers.getSigners())[0]

    // deploy test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    PaymentToken = await TestTokenFactory.deploy(
      'Test Payment Token',
      'PAY',
      '21000000000000000000000000' // 21 million * 10**18
    )
    SaleToken = await TestTokenFactory.deploy(
      'Test Sale Token',
      'SALE',
      '21000000000000000000000000' // 21 million * 10**18
    )

    // deploy allocation master
    const IFAllocationMasterFactory = await ethers.getContractFactory(
      'IFAllocationMaster'
    )
    IFAllocationMaster = await IFAllocationMasterFactory.deploy()

    // deploy launchpad
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    IFAllocationSale = await IFAllocationSaleFactory.deploy(
      salePrice,
      PaymentToken.address,
      SaleToken.address,
      IFAllocationMaster.address,
      snapshotBlock,
      startBlock,
      endBlock,
      minDeposit,
      maxDeposit
    )
  })

  it('can pay', async function () {
    // amount to pay
    const paymentAmount = 1000000

    // fast forward blocks to get to start block
    while ((await ethers.provider.getBlockNumber()) < startBlock) {
      mineNext()
    }

    // test start block
    mineNext()
    await PaymentToken.approve(IFAllocationSale.address, paymentAmount)
    await IFAllocationSale.purchase(paymentAmount)

    // check that payment was recorded
    mineNext()
    expect(await IFAllocationSale.paymentReceived(owner.address)).to.equal(
      paymentAmount
    )
  })
})
