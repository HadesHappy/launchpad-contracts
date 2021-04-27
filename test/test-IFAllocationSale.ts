import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'

export default describe('IF Allocation Sale', function () {
  it('all tests', async function () {
    // get owner
    // const [owner] = await ethers.getSigners()

    // deploy test tokens (ifusd, idia)
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    const IFUSD = await TestTokenFactory.deploy(
      'IFUSD Token',
      'IFUSD',
      21_000_000_000
    )
    const IDIA = await TestTokenFactory.deploy(
      'IDIA Token',
      'IDIA',
      21_000_000_000
    )

    // deploy statemaster
    const IFStateMasterFactory = await ethers.getContractFactory(
      'IFStateMaster'
    )
    const IFStateMaster = await IFStateMasterFactory.deploy()

    // launchpad parameters
    const startBlock = 10
    const endBlock = 20
    const allocSnapshotBlock = 5
    const minDeposit = '250000000000000000000000'
    const maxDeposit = '25000000000000000000000000'

    // deploy launchpad
    const IFAllocationSaleFactory = await ethers.getContractFactory(
      'IFAllocationSale'
    )
    const IFAllocationSale = await IFAllocationSaleFactory.deploy(
      IFStateMaster.address,
      startBlock,
      endBlock,
      allocSnapshotBlock,
      minDeposit,
      maxDeposit,
      IFUSD.address,
      IDIA.address
    )

    // test

    expect(await IFAllocationSale.startBlock()).to.equal(startBlock)
  })
})
