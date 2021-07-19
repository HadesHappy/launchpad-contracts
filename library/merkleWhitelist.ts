import { ethers } from 'ethers'
import { Decimal } from 'decimal.js'

// configure decimal
Decimal.set({ toExpPos: 9e15 })
Decimal.set({ toExpNeg: -9e15 })
Decimal.set({ rounding: Decimal.ROUND_DOWN })
Decimal.set({ precision: 64 })

// searches for an address and returns its index
export const getAddressIndex = (addresses: string[], address: string) => {
  // get leaves from addresses
  const leaves = computeLeaves(addresses)

  // get index
  let index = -1
  leaves.forEach((leaf, i) => {
    if (leaf === hashAddress(address)) index = i
  })
  // console.log('getting idx', address, index)

  return index
}

// compute a merkle proof given a list of addresses and an index within that list
export const computeMerkleProof = (addresses: string[], index: number) => {
  // get leaves from addresses
  const leaves = computeLeaves(addresses)

  // compute proof
  let path = index
  let proof = []
  let tempLeaves = [...leaves]
  while (tempLeaves.length > 1) {
    if (path % 2 === 1) {
      proof.push(tempLeaves[path - 1])
    } else {
      if (path + 1 < tempLeaves.length) proof.push(tempLeaves[path + 1])
      else proof.push(tempLeaves[path])
    }

    // reduce merkle tree one level
    tempLeaves = merkleReduce(tempLeaves)

    // move up
    path = Math.floor(path / 2)
  }

  return proof
}

// compute the merkle root from an array of packages
export const computeMerkleRoot = (addresses: string[]) => {
  const leaves = computeLeaves(addresses)

  // compute root
  let tempLeaves = [...leaves]
  while (tempLeaves.length > 1) {
    tempLeaves = merkleReduce(tempLeaves)
  }

  return tempLeaves[0]
}

// compute leaves from packages
const computeLeaves = (addresses: string[]) => {
  // normalize addresses
  const normalized = addresses.sort()

  // hash
  const hashed = [...normalized].map((a) => {
    // console.log('hashing', a, hashAddress(a))
    return hashAddress(a)
  })

  // console.log('----')

  // pairwise sort
  const pairwiseSorted = []
  while (hashed.length) {
    const leaf1 = hashed.shift() as string
    const leaf2 = hashed.length === 0 ? leaf1 : (hashed.shift() as string)
    // sort leaf 1 and leaf 2
    const [left, right] = leaf1 <= leaf2 ? [leaf1, leaf2] : [leaf2, leaf1]
    pairwiseSorted.push(left)
    if (left !== right) pairwiseSorted.push(right)
  }

  return pairwiseSorted
}

// hash an address
const hashAddress = (address: string) => {
  // leftpad
  // const paddedIndex = pad(index.toString(16))

  // generate string to hash
  const hashString = '0x' + normalizeAddress(address)

  // hash
  return ethers.utils.keccak256(hashString)
}

// pad a string with some character
const pad = (str: string, width: number = 64, char: string = '0') => {
  return char.repeat(Math.max(0, width - str.length)) + str
}

// reduce a level of the merkle tree
const merkleReduce = (leaves: string[]) => {
  let output = []

  while (leaves.length) {
    const leaf1 = (leaves.shift() as string).replace(/^0x/, '')
    const leaf2 =
      leaves.length === 0
        ? leaf1
        : (leaves.shift() as string).replace(/^0x/, '')

    // sort leaf 1 and leaf 2
    const [left, right] = leaf1 <= leaf2 ? [leaf1, leaf2] : [leaf2, leaf1]

    output.push(ethers.utils.keccak256('0x' + left + right))
  }

  return output
}

// normalizes an address (removes '0x' prefix if exists, lowercases, etc)
const normalizeAddress = (address: string) => {
  return address.toLowerCase().replace(/^0x/, '')
}
