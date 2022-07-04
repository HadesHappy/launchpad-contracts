// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'
import BatchMintParams from './inputs/BatchMintParams.json'

export async function main(): Promise<void> {
  // We get the contract to deploy
  const BatchMintFactory = await hre.ethers.getContractFactory('BatchMintVoucher')
  
  const BatchMint = await BatchMintFactory.deploy(
    BatchMintParams.proxyAddress,
    BatchMintParams.idiaAddress,
    BatchMintParams.vestingPoolAddress,
  )

  console.log('BatchMintVoucher contract deployed to ', BatchMint.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
