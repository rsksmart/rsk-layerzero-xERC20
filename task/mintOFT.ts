import { ethers } from 'ethers'
import { task } from 'hardhat/config'
import '@nomicfoundation/hardhat-ethers'
import { parseUnits } from '@ethersproject/units'
import {
    createGetHreByEid,
    createProviderFactory,
    getEidForNetworkName
} from '@layerzerolabs/devtools-evm-hardhat'

// ABI for the mint function
const MINT_FUNCTION_ABI = [
    "function mint(address _to, uint256 _amount) public",
    "function decimals() public view returns (uint8)"
];

task('lz:oft:mint', 'Mint OFT tokens on a specified network')
    .addParam('contract', 'OFT contract address')
    .addOptionalParam('recipient', 'Address to receive the minted tokens (defaults to sender)')
    .addParam('targetNetwork', 'Name of the network')
    .addParam('amount', 'Amount to mint in token decimals')
    .addParam('privateKey', 'Private key of the contract owner')
    .setAction(async (taskArgs, hre) => {
        const eid = getEidForNetworkName(taskArgs.targetNetwork)
        const contractAddress = taskArgs.contract
        
        // Set up the environment
        const environmentFactory = createGetHreByEid()
        const providerFactory = createProviderFactory(environmentFactory)
        const provider = await providerFactory(eid)
        
        // Create wallet from private key
        const wallet = new ethers.Wallet(taskArgs.privateKey, provider)
        console.log(`Using address: ${wallet.address}`)
        
        // Use provided recipient or default to sender
        const recipient = taskArgs.recipient || wallet.address
        console.log(`Recipient: ${recipient}`)
        
        try {
            // Create a contract instance directly with the ABI we need
            const oftContract = new ethers.Contract(contractAddress, MINT_FUNCTION_ABI, wallet);
                
            try {
                // Get decimals to properly parse the amount
                const decimals = await oftContract.decimals()
                const amount = parseUnits(taskArgs.amount, decimals)
                
                console.log(`Minting ${taskArgs.amount} token(s) to ${recipient} on network ${taskArgs.targetNetwork}`)
                
                // Fetch the current gas price
                const gasPrice = await provider.getGasPrice()
                
                // Execute the mint function
                const tx = await oftContract.mint(recipient, amount, {
                    gasPrice: gasPrice.mul(2),
                    gasLimit: 500000
                })
                
                console.log('Transaction hash:', tx.hash)
                
                const receipt = await tx.wait()
                
                console.log(`Successfully minted ${taskArgs.amount} token(s) to ${recipient}`)
                console.log(`Transaction confirmed in block ${receipt.blockNumber}`)
                
            } catch (error) {
                console.error('Error during minting operation:', error.message || error)
                
                if (error.message && error.message.includes("missing revert data")) {
                    console.error('This error likely means the contract does not have a mint function.')
                    console.error('Please make sure you are using a MyOFTMock contract that has the mint function exposed.')
                }
                
                // Check if error is an object and has data property
                if (error && typeof error === 'object' && 'data' in error) {
                    console.error("Reverted with data:", error.data)
                }
            }
        } catch (error) {
            console.error('General error:', error.message || error)
        }
    }) 