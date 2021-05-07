import { ethers, network } from 'hardhat'

export const mineNext = async () => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}

export const getGasUsed = async () => {
  // current block number
  const currBlockNum = await ethers.provider.getBlockNumber()

  // current block
  const currBlock = await ethers.provider.getBlock(currBlockNum)

  // gas used
  const gasUsed = currBlock.gasUsed

  return gasUsed
}
