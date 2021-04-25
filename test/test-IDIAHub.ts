import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'

export default describe('IDIA Launchpad', function () {
  it('all tests', async function () {
    // get owner
    // const [owner] = await ethers.getSigners()

    // deploy test tokens (ifusd, idia)
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    const ifusd = await TestTokenFactory.deploy(
      'IFUSD Token',
      'IFUSD',
      21_000_000_000
    )
    const idia = await TestTokenFactory.deploy(
      'IDIA Token',
      'IDIA',
      21_000_000_000
    )

    // launchpad parameters
    const startBlock = 10
    const endBlock = 20
    const minDeposit = 250000000000000000000000
    const maxDeposit = 25000000000000000000000000

    // deploy launchpad
    const IDIAHubFactory = await ethers.getContractFactory('IDIAHub')
    const IDIAHub = await IDIAHubFactory.deploy(
      // statemaster
      startBlock,
      endBlock,
      minDeposit,
      maxDeposit,
      ifusd.address,
      idia.address
    )

    // test

    expect(await IDIAHub.startBlock()).to.equal(startBlock)
  })
})
