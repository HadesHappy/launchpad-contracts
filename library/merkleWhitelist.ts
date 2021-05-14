import { ethers } from 'ethers'
import { Decimal } from 'decimal.js'

// configure decimal
Decimal.set({ toExpPos: 9e15 })
Decimal.set({ toExpNeg: -9e15 })
Decimal.set({ rounding: Decimal.ROUND_DOWN })
Decimal.set({ precision: 64 })

// searches for an address and returns its index
export const getAddressIndex = (addresses: string[], address: string) => {
  // get lookup address normalized
  const normAddress = normalizeAddress(address)

  // get index
  let index = -1
  addresses.forEach((a, i) => {
    if (normalizeAddress(a) === normAddress) index = i
  })

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
  console.log('templeaves', leaves)
  while (tempLeaves.length > 1) {
    if (path % 2 == 1) proof.push(tempLeaves[path - 1])
    else proof.push(tempLeaves[path + 1])

    // reduce merkle tree one level
    merkleReduce(tempLeaves)

    // move up
    path = Math.floor(path / 2)
  }

  console.log('proof', proof)

  return proof
}

// compute the merkle root from an array of packages
export const computeMerkleRoot = (addresses: string[]) => {
  const leaves = computeLeaves(addresses)

  console.log('leaves in compute root', leaves)

  // compute root
  let tempLeaves = [...leaves]
  while (tempLeaves.length > 1) {
    tempLeaves = merkleReduce(tempLeaves)
  }

  console.log(tempLeaves)

  return tempLeaves[0]
}

// compute leaves from packages
const computeLeaves = (addresses: string[]) => {
  // normalize addresses
  const normalized = addresses.map((a) => normalizeAddress(a))

  // sort
  let sorted = [...normalized].sort((a, b) => {
    const lowerA = normalizeAddress(a)
    const lowerB = normalizeAddress(b)
    if (lowerA < lowerB) return -1
    if (lowerA > lowerB) return 1
  })

  console.log(sorted)

  // hash
  sorted = sorted.map((a, i) => hashAddress(a, i))

  sorted = sorted.sort()

  // prepend `0x`
  // sorted = sorted.map((a) => '0x' + a)

  console.log('leaves', sorted)
  return sorted
}

// hash an address
const hashAddress = (address: string, index: number) => {
  // leftpad
  const paddedIndex = pad(index.toString(16))

  // generate string to hash
  const hashString = '0x' + paddedIndex + address

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
    const left = leaves.shift().replace(/^0x/, '')
    const right = leaves.length === 0 ? left : leaves.shift().replace(/^0x/, '')

    console.log('lr', left, right)
    output.push(ethers.utils.keccak256('0x' + left + right))
  }

  return output
}

// normalizes an address (removes '0x' prefix if exists, lowercases, etc)
const normalizeAddress = (address: string) => {
  return address.toLowerCase().replace(/^0x/, '')
}
