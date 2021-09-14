import has from 'lodash/has'
import { Contract, utils } from 'ethers'
import {
  getWeb3,
  getNetworkId,
  getProvider,
  getAccount,
  getSigner
} from './web3'
import { normalize } from 'eth-ens-namehash'
import { formatsByName } from '@ensdomains/address-encoder'
import { abi as ensContract } from '@ensdomains/contracts/abis/ens/ENS.json'
import { constants, Wallet } from 'ethers'
import { decryptHashes } from './preimage'
import {
  uniq,
  getEnsStartBlock,
  checkLabels,
  mergeLabels,
  emptyAddress,
  isDecrypted,
  namehash,
  labelhash
} from './utils'
import { encodeLabelhash } from './utils/labelhash'

import {
  getTestRegistrarContract,
  getReverseRegistrarContract,
  getENSContract,
  getResolverContract,
  getOldResolverContract
} from './contracts'

import {
  isValidContenthash,
  encodeContenthash,
  decodeContenthash
} from './utils/contents'
import Web3 from 'web3'

/* Utils */

export function getNamehash(name) {
  return namehash(name)
}

async function getNamehashWithLabelHash(labelHash, nodeHash) {
  let node = utils.keccak256(nodeHash + labelHash.slice(2))
  return node.toString()
}

function getLabelhash(label) {
  return labelhash(label)
}

const contracts = {
  1: {
    registry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  3: {
    registry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  4: {
    registry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  },
  5: {
    registry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  }
}

export class ENS {

  constructor({ networkId, registryAddress, provider }) {
    this.contracts = contracts
    const hasRegistry = has(this.contracts[networkId], 'registry')

    if (!hasRegistry && !registryAddress) {
      throw new Error(`Unsupported network ${networkId}`)
    } else if (this.contracts[networkId] && !registryAddress) {
      registryAddress = contracts[networkId].registry
    }

    this.registryAddress = registryAddress;
    this.decentraNameContract = {};
    this.decentraControllerContract = {};
    this.rootRegistrarContract = {};
    this.rootRegistrarControllerContract = {};

    const ENSContract = getENSContract({ address: registryAddress, provider })
    this.ENS = ENSContract
  }

  setDecentraNameContract(instance) {
    this.decentraNameContract = instance;
  }

  setENSRegistryContract(instance) {
    this.ENS = instance;
  }

  setDecentraControllerContract(instance) {
    this.decentraControllerContract = instance;
  }

  setRootRegistrarContract(instance) {
    this.rootRegistrarContract = instance;
  }

  setRootRegistrarControllerContract(instance) {
    this.rootRegistrarControllerContract = instance;
  }

  /* Get the raw Ethers contract object */
  getENSContractInstance() {
    return this.ENS
  }

  /* Main methods */

  async getOwner(name) {
    try {
      const namehash = getNamehash(name)
      const owner = await this.ENS.owner(namehash);
      return owner;
    }
    catch (error) {
      console.log("🚀 ~ file: ens.js ~ line 118 ~ ENS ~ getOwner ~ error", error)
      return constants.AddressZero;
    }

  }

  async getResolver(name) {
    const namehash = getNamehash(name)
    return this.ENS.resolver(namehash)
  }

  async getTTL(name) {
    const namehash = getNamehash(name)
    return this.ENS.ttl(namehash)
  }

  // async getResolverWithLabelhash(labelhash, nodehash) {
  //   const namehash = await getNamehashWithLabelHash(labelhash, nodehash)
  //   return this.ENS.resolver(namehash)
  // }

  async getOwnerWithLabelHash(labelhash, nodeHash) {
    const namehash = await getNamehashWithLabelHash(labelhash, nodeHash)
    return this.ENS.owner(namehash)
  }

  // async getEthAddressWithResolver(name, resolverAddr) {
  //   if (parseInt(resolverAddr, 16) === 0) {
  //     return emptyAddress
  //   }
  //   const namehash = getNamehash(name)
  //   try {
  //     const provider = await getProvider()
  //     const Resolver = getResolverContract({
  //       address: resolverAddr,
  //       provider
  //     })
  //     const addr = await Resolver['addr(bytes32)'](namehash)
  //     return addr
  //   } catch (e) {
  //     console.warn(
  //       'Error getting addr on the resolver contract, are you sure the resolver address is a resolver contract?'
  //     )
  //     return emptyAddress
  //   }
  // }

  // async getAddress(name) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.getEthAddressWithResolver(name, resolverAddr)
  // }

  // async getAddr(name, key) {
  //   const resolverAddr = await this.getResolver(name)
  //   if (parseInt(resolverAddr, 16) === 0) return emptyAddress
  //   return this.getAddrWithResolver(name, key, resolverAddr)
  // }

  // async getAddrWithResolver(name, key, resolverAddr) {
  //   const namehash = getNamehash(name)
  //   try {
  //     const provider = await getProvider()
  //     const Resolver = getResolverContract({
  //       address: resolverAddr,
  //       provider
  //     })
  //     const { coinType, encoder } = formatsByName[key]
  //     const addr = await Resolver['addr(bytes32,uint256)'](namehash, coinType)
  //     if (addr === '0x') return emptyAddress

  //     return encoder(Buffer.from(addr.slice(2), 'hex'))
  //   } catch (e) {
  //     console.log(e)
  //     console.warn(
  //       'Error getting addr on the resolver contract, are you sure the resolver address is a resolver contract?'
  //     )
  //     return emptyAddress
  //   }
  // }

  // async getContent(name) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.getContentWithResolver(name, resolverAddr)
  // }

  // async getContentWithResolver(name, resolverAddr) {
  //   if (parseInt(resolverAddr, 16) === 0) {
  //     return emptyAddress
  //   }
  //   try {
  //     const namehash = getNamehash(name)
  //     const provider = await getProvider()
  //     const Resolver = getResolverContract({
  //       address: resolverAddr,
  //       provider
  //     })
  //     const contentHashSignature = utils
  //       .solidityKeccak256(['string'], ['contenthash(bytes32)'])
  //       .slice(0, 10)

  //     const isContentHashSupported = await Resolver.supportsInterface(
  //       contentHashSignature
  //     )

  //     if (isContentHashSupported) {
  //       const encoded = await Resolver.contenthash(namehash)
  //       const { protocolType, decoded, error } = decodeContenthash(encoded)
  //       if (error) {
  //         return {
  //           value: error,
  //           contentType: 'error'
  //         }
  //       }
  //       return {
  //         value: `${protocolType}://${decoded}`,
  //         contentType: 'contenthash'
  //       }
  //     } else {
  //       const value = await Resolver.content(namehash)
  //       return {
  //         value,
  //         contentType: 'oldcontent'
  //       }
  //     }
  //   } catch (e) {
  //     const message =
  //       'Error getting content on the resolver contract, are you sure the resolver address is a resolver contract?'
  //     console.warn(message, e)
  //     return { value: message, contentType: 'error' }
  //   }
  // }

  // async getText(name, key) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.getTextWithResolver(name, key, resolverAddr)
  // }

  // async getTextWithResolver(name, key, resolverAddr) {
  //   if (parseInt(resolverAddr, 16) === 0) {
  //     return ''
  //   }
  //   const namehash = getNamehash(name)
  //   try {
  //     const provider = await getProvider()
  //     const Resolver = getResolverContract({
  //       address: resolverAddr,
  //       provider
  //     })
  //     const addr = await Resolver.text(namehash, key)
  //     return addr
  //   } catch (e) {
  //     console.warn(
  //       'Error getting text record on the resolver contract, are you sure the resolver address is a resolver contract?'
  //     )
  //     return ''
  //   }
  // }

  // async getName(address) {
  //   const reverseNode = `${address.slice(2)}.addr.reverse`
  //   const resolverAddr = await this.getResolver(reverseNode)
  //   return this.getNameWithResolver(address, resolverAddr)
  // }

  // async getNameWithResolver(address, resolverAddr) {
  //   const reverseNode = `${address.slice(2)}.addr.reverse`
  //   const reverseNamehash = getNamehash(reverseNode)
  //   if (parseInt(resolverAddr, 16) === 0) {
  //     return {
  //       name: null
  //     }
  //   }

  //   try {
  //     const provider = await getProvider()
  //     const Resolver = getResolverContract({
  //       address: resolverAddr,
  //       provider
  //     })
  //     const name = await Resolver.name(reverseNamehash)
  //     return {
  //       name
  //     }
  //   } catch (e) {
  //     console.log(`Error getting name for reverse record of ${address}`, e)
  //   }
  // }

  // async isMigrated(name) {
  //   const namehash = getNamehash(name)
  //   return this.ENS.recordExists(namehash)
  // }

  // async getResolverDetails(node) {
  //   try {
  //     const addrPromise = this.getAddress(node.name)
  //     const contentPromise = this.getContent(node.name)
  //     const [addr, content] = await Promise.all([addrPromise, contentPromise])
  //     return {
  //       ...node,
  //       addr,
  //       content: content.value,
  //       contentType: content.contentType
  //     }
  //   } catch (e) {
  //     return {
  //       ...node,
  //       addr: '0x0',
  //       content: '0x0',
  //       contentType: 'error'
  //     }
  //   }
  // }

  async getSubdomains(name) {
    try {
      const startBlock = await getEnsStartBlock()
      const namehash = getNamehash(name)
      const rawLogs = await this.getENSEvent('NewOwner', {
        topics: [namehash],
        fromBlock: startBlock
      })
      const flattenedLogs = rawLogs.map(log => log.args)
      flattenedLogs.reverse()
      const logs = uniq(flattenedLogs, 'label')
      const labelhashes = logs.map(log => log.label)
      const remoteLabels = await decryptHashes(...labelhashes)
      const localLabels = checkLabels(...labelhashes)
      const labels = mergeLabels(localLabels, remoteLabels)
      const ownerPromises = labels.map(label => this.getOwner(`${label}.${name}`))

      return Promise.all(ownerPromises).then(owners =>
        owners.map((owner, index) => {
          return {
            label: labels[index],
            labelhash: logs[index].label,
            decrypted: labels[index] !== null,
            node: name,
            name: `${labels[index] ||
              encodeLabelhash(logs[index].label)}.${name}`,
            owner
          }
        })
      )
    }
    catch (error) {
      console.log("🚀 ~ file: ens.js ~ line 344 ~ ENS ~ getSubdomains ~ error", error)
    }

  }

  async getDomainDetails(name) {
    const nameArray = name.split('.')
    const labelhash = getLabelhash(nameArray[0]);
    const [
      owner,
      // resolver
    ] = await Promise.all([
      this.getOwner(name),
      // this.getResolver(name)
    ])
    const node = {
      name,
      label: nameArray[0],
      labelhash,
      owner,
      // resolver
    }

    // const hasResolver = parseInt(node.resolver, 16) !== 0

    // if (hasResolver) {
    //   return this.getResolverDetails(node)
    // }

    return {
      ...node,
      addr: null,
      content: null
    }
  }

  /* non-constant functions */

  async getVRS(msgParams) {
    
    const provider = await getWeb3();

    var from = await getAccount();

    console.log('CLICKED, SENDING PERSONAL SIGN REQ', 'from', from, msgParams, provider)
    var params = [from, msgParams]
    console.dir(params)
    var method = 'eth_signTypedData_v3'
    const web3 = new Web3(provider.provider);
    const result = await web3.currentProvider.send({
      method,
      params,
      from,
    }, async function (err, result) {
      return new Promise((resolve, reject) => {
        
        if (err) {
          return reject(err);
        } 
        if (result.error) {
          console.log(result.error.message)
        }
        if (result.error) {
          return reject(result)
        } 
        console.log('TYPED SIGNED:' + JSON.stringify(result.result))

        const signature = result.result.substring(2);
        const r = "0x" + signature.substring(0, 64);
        const s = "0x" + signature.substring(64, 128);
        const v = parseInt(signature.substring(128, 130), 16);
        resolve({ v, r, s });
      })
    });
    console.log("🚀 ~ file: ens.js ~ line 479 ~ ENS ~ getVRS ~ result", result)
    return result;
  }

  async setOwner(name, newOwner) {
    try {
      const namehash = getNamehash(name);

      const msgParams = JSON.stringify({
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" }
          ],
          transferToken: [
            { name: "transferTo", type: "address" },
            { name: "id", type: "uint256" }
          ]
        },
        primaryType: "transferToken",
        domain: {
          name: "decentraname",
          version: "1",
          chainId: 4,
          verifyingContract: this.decentraControllerContract.address
        },
        message: {
          transferTo: newOwner,
          id: namehash
        }
      })
      const result = await this.getVRS(msgParams);
      const { v, r, s } = result;
      const ENSWithoutSigner = this.ENS
      const signer = await getSigner()
      const ENS = ENSWithoutSigner.connect(signer)
      return ENS.setOwner(namehash, newOwner, v, r, s)  
    }
    catch (error) {
      console.log("🚀 ~ file: ens.js ~ line 479 ~ ENS ~ setOwner ~ error", error)
    }
  }

  async setSubnodeOwner(name, newOwner) {
    try {

      const nameArray = name.split('.')
      const label = nameArray[0]
      const node = nameArray.slice(1).join('.')
      const labelhash = getLabelhash(label)
      const parentNamehash = getNamehash(node)

      const msgParams = JSON.stringify({
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" }
          ],
          transferToken: [
            { name: "transferTo", type: "address" },
            { name: "id", type: "uint256" }
          ]
        },
        primaryType: "transferToken",
        domain: {
          name: "decentraname",
          version: "1",
          chainId: 4,
          verifyingContract: this.decentraControllerContract.address
        },
        message: {
          transferTo: newOwner,
          id: getNamehash(name)
        }
      })

      const result = await this.getVRS(msgParams);
      const { v, r, s } = result;

      const ENSWithoutSigner = this.ENS
      const signer = await getSigner()
      const ENS = ENSWithoutSigner.connect(signer)
      
      return ENS.setSubnodeOwner(parentNamehash, labelhash, newOwner, v, r, s)
    }
    catch (error) {
      console.log("🚀 ~ file: ens.js ~ line 429 ~ ENS ~ setSubnodeOwner ~ error", error)
    }
  }

  async approve(address) {
    try {
      const decentra = this.decentraNameContract
      const signer = await getSigner()
      const decentraSigned = decentra.connect(signer)
      return decentraSigned.setApprovalForAll(address, true);
    }
    catch (error) {
      console.log("🚀 ~ file: ens.js ~ line 429 ~ ENS ~ setSubnodeOwner ~ error", error)
    }
  }

  async setSubnodeRecord(name, newOwner, resolver) {
    const ENSWithoutSigner = this.ENS
    const signer = await getSigner()
    const ENS = ENSWithoutSigner.connect(signer)
    const nameArray = name.split('.')
    const label = nameArray[0]
    const node = nameArray.slice(1).join('.')
    const labelhash = getLabelhash(label)
    const parentNamehash = getNamehash(node)
    const ttl = await this.getTTL(name)
    return ENS.setSubnodeRecord(
      parentNamehash,
      labelhash,
      newOwner,
      resolver,
      ttl
    )
  }

  // async setResolver(name, resolver) {
  //   const namehash = getNamehash(name)
  //   const ENSWithoutSigner = this.ENS
  //   const signer = await getSigner()
  //   const ENS = ENSWithoutSigner.connect(signer)
  //   return ENS.setResolver(namehash, resolver)
  // }

  // async setAddress(name, address) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.setAddressWithResolver(name, address, resolverAddr)
  // }

  // async setAddressWithResolver(name, address, resolverAddr) {
  //   const namehash = getNamehash(name)
  //   const provider = await getProvider()
  //   const ResolverWithoutSigner = getResolverContract({
  //     address: resolverAddr,
  //     provider
  //   })
  //   const signer = await getSigner()
  //   const Resolver = ResolverWithoutSigner.connect(signer)
  //   return Resolver['setAddr(bytes32,address)'](namehash, address)
  // }

  // async setAddr(name, key, address) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.setAddrWithResolver(name, key, address, resolverAddr)
  // }

  // async setAddrWithResolver(name, key, address, resolverAddr) {
  //   const namehash = getNamehash(name)
  //   const provider = await getProvider()
  //   const ResolverWithoutSigner = getResolverContract({
  //     address: resolverAddr,
  //     provider
  //   })
  //   const signer = await getSigner()
  //   const Resolver = ResolverWithoutSigner.connect(signer)
  //   const { decoder, coinType } = formatsByName[key]
  //   let addressAsBytes
  //   if (!address || address === '') {
  //     addressAsBytes = Buffer.from('')
  //   } else {
  //     addressAsBytes = decoder(address)
  //   }
  //   return Resolver['setAddr(bytes32,uint256,bytes)'](
  //     namehash,
  //     coinType,
  //     addressAsBytes
  //   )
  // }

  // async setContent(name, content) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.setContentWithResolver(name, content, resolverAddr)
  // }

  // async setContentWithResolver(name, content, resolverAddr) {
  //   const namehash = getNamehash(name)
  //   const provider = await getProvider()
  //   const ResolverWithoutSigner = getResolverContract({
  //     address: resolverAddr,
  //     provider
  //   })
  //   const signer = await getSigner()
  //   const Resolver = ResolverWithoutSigner.connect(signer)
  //   return Resolver.setContent(namehash, content)
  // }

  // async setContenthash(name, content) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.setContenthashWithResolver(name, content, resolverAddr)
  // }

  // async setContenthashWithResolver(name, content, resolverAddr) {
  //   let encodedContenthash = content
  //   if (parseInt(content, 16) !== 0) {
  //     encodedContenthash = encodeContenthash(content)
  //   }
  //   const namehash = getNamehash(name)
  //   const provider = await getProvider()
  //   const ResolverWithoutSigner = getResolverContract({
  //     address: resolverAddr,
  //     provider
  //   })
  //   const signer = await getSigner()
  //   const Resolver = ResolverWithoutSigner.connect(signer)
  //   return Resolver.setContenthash(namehash, encodedContenthash)
  // }

  // async setText(name, key, recordValue) {
  //   const resolverAddr = await this.getResolver(name)
  //   return this.setTextWithResolver(name, key, recordValue, resolverAddr)
  // }

  // async setTextWithResolver(name, key, recordValue, resolverAddr) {
  //   const namehash = getNamehash(name)
  //   const provider = await getProvider()
  //   const ResolverWithoutSigner = getResolverContract({
  //     address: resolverAddr,
  //     provider
  //   })
  //   const signer = await getSigner()
  //   const Resolver = ResolverWithoutSigner.connect(signer)
  //   return Resolver.setText(namehash, key, recordValue)
  // }

  async createSubdomain(name) {
    try {
      const account = await getAccount();
      const split = name.split('.');
      const label = split[0];
      const parent = name.substring(name.indexOf('.') + 1)
      // namehash.hash(parent), '0x' + sha3(namehash.normalize(label)), owner
      let ensRegistry = this.ENS;
      const signer = await getSigner();
      ensRegistry = ensRegistry.connect(
        signer
      )
      console.log(
        "🚀 ~ file: ens.js ~ line 597 ~ ENS ~ createSubdomain ~ label",
        getNamehash(parent),
        utils.keccak256(utils.toUtf8Bytes(normalize(label))),
        normalize(label),
        utils.toUtf8Bytes(normalize(label))
      )

      return ensRegistry.createSubnode(getNamehash(parent), utils.keccak256(utils.toUtf8Bytes(normalize(label))), account)
    } catch (e) {
      console.log('error creating subdomain', e)
    }
  }

  async deleteSubdomain(name) {
    try {
      return this.setSubnodeRecord(name, emptyAddress, emptyAddress)
    } catch (e) {
      console.log('error deleting subdomain', e)
    }
  }

  async claimAndSetReverseRecordName(name, overrides = {}) {
    const reverseRegistrarAddr = await this.getOwner('addr.reverse')
    const provider = await getProvider(0)
    const reverseRegistrarWithoutSigner = getReverseRegistrarContract({
      address: reverseRegistrarAddr,
      provider
    })
    const signer = await getSigner()
    const reverseRegistrar = reverseRegistrarWithoutSigner.connect(signer)
    const networkId = await getNetworkId()

    if (parseInt(networkId) > 1000) {
      const gasLimit = await reverseRegistrar.estimateGas.setName(name)
      overrides = {
        gasLimit: gasLimit.toNumber() * 2,
        ...overrides
      }
    }

    return reverseRegistrar.setName(name, overrides)
  }

  // async setReverseRecordName(name) {
  //   const account = await getAccount()
  //   const provider = await getProvider()
  //   const reverseNode = `${account.slice(2)}.addr.reverse`
  //   const resolverAddr = await this.getResolver(reverseNode)
  //   const ResolverWithoutSigner = getResolverContract({
  //     address: resolverAddr,
  //     provider
  //   })
  //   const signer = await getSigner()
  //   const Resolver = ResolverWithoutSigner.connect(signer)
  //   let namehash = getNamehash(reverseNode)
  //   return Resolver.setName(namehash, name)
  // }

  // Events

  async getENSEvent(event, { topics, fromBlock }) {
    try {
      const provider = await getWeb3()
      const { ENS } = this
      const ensInterface = new utils.Interface(ensContract)
      let Event = ENS.filters[event]()

      const filter = {
        fromBlock,
        toBlock: 'latest',
        address: Event.address,
        topics: [...Event.topics, ...topics]
      }

      const logs = await provider.getLogs(filter)

      const parsed = logs.map(log => {
        const parsedLog = ensInterface.parseLog(log)
        return parsedLog
      })

      return parsed
    }
    catch (error) {
      console.log("🚀 ~ file: ens.js ~ line 631 ~ ENS ~ getENSEvent ~ error", error)

    }

  }
}
