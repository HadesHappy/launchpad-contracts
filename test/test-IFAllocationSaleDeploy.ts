import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { getBlockTime, mineNext, mineTimeDelta } from './helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'

export default describe('IF Allocation Sale Deployment', function () {
  this.timeout(0)

  // deployer address
  let owner: SignerWithAddress
  let buyer: SignerWithAddress
  let seller: SignerWithAddress
  let casher: SignerWithAddress

  // contract vars
  let StakeToken: Contract
  let PaymentToken: Contract
  let SaleToken: Contract
  let IFAllocationMaster: Contract

  const maxTotalDeposit = '25000000000000000000000000' // max deposit

  beforeEach(async () => {
    // get test accounts
    owner = (await ethers.getSigners())[0]
    buyer = (await ethers.getSigners())[1]
    seller = (await ethers.getSigners())[2]
    casher = (await ethers.getSigners())[3]

    // deploy test tokens
    const TestTokenFactory = await ethers.getContractFactory('GenericToken')
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
    mineNext()
    // deploy master and track
    const IFAllocationMasterFactory = await ethers.getContractFactory(
      'IFAllocationMaster'
    )
    IFAllocationMaster = await IFAllocationMasterFactory.deploy()
    mineNext()
    await IFAllocationMaster.addTrack(
      'IDIA track', // name
      StakeToken.address, // stake token
      10000, // weight accrual rate
      '100000000000000000', // passive rollover rate (10%)
      '200000000000000000', // active rollover rate (20%)
      '1000000000000000000000000000000' // max total stake (1 trillion)
    )
    mineNext()
  })

  // TokenAddress = PaymentAddress
  it('should failed, saleToken = paymentToken', async () => {
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    const currTime = await getBlockTime()
    await expect(
      IFAllocationSaleFactory.deploy(
        1,
        seller.address,
        SaleToken.address, // test sale token = payment token
        SaleToken.address,
        IFAllocationMaster.address,
        0,
        currTime + 50,
        currTime + 150,
        currTime + 250,
        maxTotalDeposit
      )
    ).to.be.revertedWith('saleToken = paymentToken')
  })

  // TokenAddress = PaymentAddress
  it('should failed when salePrice != 0, paymentToken = 0', async () => {
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    const currTime = await getBlockTime()
    await expect(
      IFAllocationSaleFactory.deploy(
        1, // salePrice not 0
        seller.address,
        ethers.constants.AddressZero,
        SaleToken.address,
        IFAllocationMaster.address,
        0,
        currTime + 50,
        currTime + 150,
        currTime + 250,
        maxTotalDeposit
      )
    ).to.be.revertedWith(
      'paymentToken or maxTotalPayment should not be 0 when salePrice is 0'
    )
  })

  // TokenAddress = PaymentAddress
  it('should failed when salePrice != 0, maxTotalPayment = 0', async () => {
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    const currTime = await getBlockTime()
    await expect(
      IFAllocationSaleFactory.deploy(
        1, // sale price 0
        seller.address,
        PaymentToken.address,
        SaleToken.address,
        IFAllocationMaster.address,
        0,
        currTime + 50,
        currTime + 150,
        currTime + 250,
        0 // maxTotalPayment 0
      )
    ).to.be.revertedWith(
      'paymentToken or maxTotalPayment should not be 0 when salePrice is 0'
    )
  })

  // TokenAddress = PaymentAddress
  it('should failed when snapshot time < currentTime, totalStakeWeight is 0', async () => {
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    const currTime = await getBlockTime()
    await expect(
      IFAllocationSaleFactory.deploy(
        1,
        seller.address,
        PaymentToken.address,
        SaleToken.address,
        IFAllocationMaster.address,
        0,
        currTime - 10, // older than current time
        currTime + 150,
        currTime + 250,
        maxTotalDeposit
      )
    ).to.be.revertedWith('total weight is 0 on while using older timestamp')
  })

  // TokenAddress = PaymentAddress
  it('should not failed when snapshot time < currentTime, totalStakeWeight > 0', async () => {
    // buyer 1 stake
    const stakeAmount = 100000000000000
    await StakeToken.connect(buyer).approve(
      IFAllocationMaster.address,
      stakeAmount
    ) // approve
    mineNext()
    await IFAllocationMaster.connect(buyer).stake(0, stakeAmount) // stake
    mineNext()
    mineTimeDelta(10)
    mineNext()
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    const currTime = await getBlockTime()
    const saleContract = await IFAllocationSaleFactory.deploy(
      1, // salePrice not 0
      seller.address,
      PaymentToken.address,
      SaleToken.address,
      IFAllocationMaster.address,
      0,
      currTime - 5,
      currTime + 150,
      currTime + 250,
      maxTotalDeposit
    )
    mineNext()
    expect(saleContract.address).to.not.be.null
  })
})
