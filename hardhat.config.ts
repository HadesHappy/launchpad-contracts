import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-web3'
import 'hardhat-gas-reporter'
import 'hardhat-tracer'
import dotenv from 'dotenv'

dotenv.config()

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: { enabled: true },
    },
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY,
      kovan: process.env.ETHERSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: 'https://bsc-dataseed.binance.org/',
      },
    },
    bsc_test: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      gasPrice: 11000000000,
      accounts: {
        // first address: 0x99cb319980e55f4737c848e01BB74b8DE7863683
        mnemonic:
          'option skill video cause achieve joy section refuse infant goose any check',
      },
    },
    bsc_main: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      gasPrice: 5000000000,
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || '',
      },
    },
    eth_ropsten: {
      url: 'https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      accounts: {
        // first address: 0x99cb319980e55f4737c848e01BB74b8DE7863683
        mnemonic:
          'option skill video cause achieve joy section refuse infant goose any check',
      },
    },
    eth_main: {
      url: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || '',
      },
    },
    polygon_main: {
      url: 'https://polygon-rpc.com',
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || '',
      },
    },
    avax_main: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: 43114,
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || '',
      },
    },
    moonriver_main: {
      url: 'https://rpc.moonriver.moonbeam.network',
      chainId: 1285,
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || '',
      },
    },
    kovan: {
      url: 'https://kovan.poa.network/',
      chainId: 42,
      gasPrice: 5000000000,
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || '',
      },
    },
  },
}
