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
  const admin: string = process.env.ADMIN || '' 
  const underlying: string = process.env.UNDERLYING || '' 

  // We get the contract to deploy
  const VIDIAFactory = await hre.ethers.getContractFactory('vIDIA')
  
  const VIDIA = await VIDIAFactory.deploy(name, symbol, admin, underlying);

  console.log('VIDIA deployed to ', VIDIA.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
