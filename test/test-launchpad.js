const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('IDIA Launchpad', function () {
  it('all tests', async function () {
    // get owner
    // const [owner] = await ethers.getSigners()

    // launchpad parameters
    const startBlock = 9

    // deploy launchpad
    const IDIAHubFactory = await ethers.getContractFactory('idiaHub')
    const IDIAHub = await IDIAHubFactory.deploy(startBlock)

    // test

    expect(await IDIAHub.startBlock()).to.equal(startBlock)
  })
})
