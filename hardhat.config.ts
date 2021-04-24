import "@nomiclabs/hardhat-waffle";

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  solidity: "0.8.0",
  networks: {
    hardhat: {},
    // rinkeby: {
    //   url:
    //     'https://eth-mainnet.alchemyapi.io/v2/123abc123abc123abc123abc123abcde',
    //   accounts: [privateKey1, privateKey2, ...]
    // },
    bsc_test: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 11000000000,
      accounts: {
        // first address: 0x99cb319980e55f4737c848e01BB74b8DE7863683
        mnemonic:
          "option skill video cause achieve joy section refuse infant goose any check",
      },
    },
    bsc_main: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 5000000000,
    },
  },
};
