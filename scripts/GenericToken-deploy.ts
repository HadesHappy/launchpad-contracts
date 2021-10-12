// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'

export async function main(): Promise<void> {
  // params
  const name: string = process.env.NAME || ''
  const symbol: string = process.env.SYMBOL || ''
  const initSupply: string = process.env.INIT_SUPPLY || '' // 18 decimals assumed

  // We get the contract to deploy
  const GenericTokenFactory = await hre.ethers.getContractFactory('GenericToken')

  // deploy token
  const Token = await GenericTokenFactory.deploy(name, symbol, initSupply)

  // log deployed addresses
  console.log('Token deployed to ', Token.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
