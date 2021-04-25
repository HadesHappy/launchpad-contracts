import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'

export default describe('IDIA Launchpad', function () {
  it('all tests', async function () {
    // get owner
    // const [owner] = await ethers.getSigners()

    // launchpad parameters
    const startBlock = 9

    // deploy launchpad
    const IDIAHubFactory = await ethers.getContractFactory('IDIAHub')
    const IDIAHub = await IDIAHubFactory.deploy(startBlock)

    // test

    expect(await IDIAHub.startBlock()).to.equal(startBlock)
  })
})
