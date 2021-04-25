import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'

export default describe('StateMaster', function () {
  it('counts tracks', async function () {
    // get owner
    const [owner] = await ethers.getSigners()

    // deploy a test token
    const TestTokenFactory = await ethers.getContractFactory('TestToken')
    const TestToken = await TestTokenFactory.deploy(
      'test token',
      'TEST',
      21_000_000_000
    )

    // deploy statemaster
    const StateMasterFactory = await ethers.getContractFactory('StateMaster')
    const StateMaster = await StateMasterFactory.deploy()

    // test

    // num tracks should be 0
    expect(await StateMaster.trackCount()).to.equal(0)

    // add a track
    await StateMaster.addTrack(TestToken.address)

    // num tracks should be 1
    expect(await StateMaster.trackCount()).to.equal(1)
  })
})
