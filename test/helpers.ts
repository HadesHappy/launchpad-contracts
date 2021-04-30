import { network } from 'hardhat'

export const mineNext = async () => {
  await network.provider.send('evm_mine') // mine next (+1 blockheight)
}
