// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main(): Promise<void> {
  // We get the contract to deploy
  const Multicall2Factory = await hre.ethers.getContractFactory('Multicall2')

  // deploy token
  const Multicall2 = await Multicall2Factory.deploy()

  // log deployed addresses
  console.log('Token deployed to ', Multicall2.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
