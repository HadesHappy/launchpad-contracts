import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { mineNext } from './helpers'
import {
  computeMerkleProof,
  computeMerkleRoot,
  getAddressIndex,
} from '../library/merkleWhitelist'
import { expect } from 'chai'

export default describe('MerkleVerifier', function () {
  // unset timeout from the test
  this.timeout(0)

  it('verifies', async function () {
    // constants

    const whitelist = [
      '0x654Ba8f3FA15d1140fe9e58cBB9eBD15ab99f8ec',
      '0xFF996df3B8ce39d326F27ab3032D92B7da548e4f',
      '0x63d5BDee0d0D427E76EB36CFF39D188FEd48FDf7',
      '0xA4B2D9E832a80B1125f9C3fc4a4F240ae8fA5804',
      '0x2972964e4C3D38A99c2e27097aCd2E9638E12B0B',
    ]
      .map((s) => s.toLowerCase())
      .sort()

    const address = whitelist[0]

    // deploy
    const MerkleVerifierFactory = await ethers.getContractFactory(
      'MerkleVerifier'
    )
    const MerkleVerifier = await MerkleVerifierFactory.deploy()

    // test
    mineNext()

    // get and display root
    const root = computeMerkleRoot(whitelist)
    // console.log('root:', root)

    // get index
    const acctIdx = getAddressIndex(whitelist, address)

    // get proof
    const proof = computeMerkleProof(whitelist, acctIdx)
    // console.log('proof', proof)

    const result = MerkleVerifier.verify(
      proof,
      root,
      ethers.utils.keccak256(address)
    )

    expect(await result).to.eq(true)
  })
})
