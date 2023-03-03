const ethers = require('ethers')
const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const { Client, GatewayIntentBits } = require('discord.js')
const axios = require('axios')
const { checkUserExistence } = require('./graphql')
const { checkIfAlreadyClaimed } = require('./utils')
dotenv.config()

const endpoint = ''

const badgeUris = [
  'bafyreide5pvibjovhoqbdx6trb2f7nqljsszdsnz2yltkl7fdphskhuxse',
]

const getProfileUrl = (address) => {
  const base_url =
    process.env.NODE_ENV === 'production'
      ? 'https://beta.otterspace.xyz'
      : 'https://staging.otterspace.xyz'
  return `${base_url}/${address}`
}

// Replace these contract addresses with your own
const {
  ALCHEMY_GOERLI,
  ALCHEMY_OPTIMISM,
  BADGES_GOERLI,
  BADGES_OPTIMISM,
  DEPLOYER_PRIVATE_KEY,
  PROD_DISCORD_TOKEN,
  STAGING_DISCORD_TOKEN,
  NODE_ENV,
  PROD_HASURA_URL,
  PROD_ADMIN_SECRET,
  STAGING_HASURA_URL,
  STAGING_ADMIN_SECRET,
} = process.env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

if (NODE_ENV === 'production') {
  client.login(PROD_DISCORD_TOKEN)
} else {
  client.login(STAGING_DISCORD_TOKEN)
}

// Initialize the ethers provider and signer
// Set up the Alchemy provider
const provider = ethers.getDefaultProvider(
  NODE_ENV === 'production' ? ALCHEMY_OPTIMISM : ALCHEMY_GOERLI,
)

const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)

// Initialize the badges contract interface
const badgesContract = new ethers.Contract(
  NODE_ENV === 'production' ? BADGES_OPTIMISM : BADGES_GOERLI,
  ['function airdrop(address[] recipients, string specUri) public'],
  signer,
)
console.log("🚀 ~ NODE_ENV === 'production':", NODE_ENV === 'production')

// Initialize the express app
const app = express()

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }))

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`)
})

client.on('guildMemberAdd', (member) => {
  const channel = member.guild.channels.cache.find(
    (ch) => ch.name === 'register',
  ) // Replace 'welcome' with the name of your channel
  if (!channel) return
  channel.send(`Welcome to the server, ${member}!


Step 1: type /register followed by your wallet address
-- example: /register 0x1234567890abcdef1234567890abcdef12345678
Step 2: go to #gm and say "gm"
Step 3: receive today's gm badge
Step 4: come back tomorrow and repeat
`)
})

client.on('messageCreate', async (message) => {
  if (message.content.includes('gm')) {
    try {
      // pull the discord id from the message
      const discord_name = message.author.username
      if (discord_name === 'gm-bot' || discord_name === 'gm') return

      const { streak, address, updated_at } = await checkUserExistence(
        discord_name,
      )
      console.log('🚀 ~ client.on ~ updated_at:', updated_at)
      const alreadyClaimed = checkIfAlreadyClaimed(streak, updated_at, message)
      console.log('🚀 ~ client.on ~ alreadyClaimed:', alreadyClaimed)
      if (alreadyClaimed) return

      // const hardCodedStreak = `ipfs://bafyreib7fdsb2ypwyn3spxspodjubiuj5ldigfmfimqtb23a6gtzbqpeve/metadata.json`
      // specUri: `ipfs://${badgeUris[streak]}/metadata.json`,
      message.reply(`Today is day ${streak} of your streak, I'm creating a soulbound token to celebrate!

I'll send you another message in about 6 seconds with a link!
            `)
      const specUri = `ipfs://${badgeUris[streak]}/metadata.json`

      await mintGm({
        recipients: [address],
        specUri,
        newStreak: streak + 1,
        message,
      })
    } catch (error) {
      console.error('error: ', error)
    }
  }

  if (message.content.startsWith('/register')) {
    const { username } = message.author
    const addressPattern = /0x[0-9a-fA-F]{40}/
    const match = message.content.match(addressPattern)

    if (match) {
      const ethereumAddress = match[0]

      const checkUserExistenceQuery = `
        query checkUserExistence($discordName: String!, $address: String!) {
          users(where: { _or: [{ discord_name: { _eq: $discordName } }, { address: { _eq: $address } }] }) {
            id
            streak
          }
        }
      `
      const variables = {
        discordName: username,
        address: ethereumAddress,
      }
      const headers = {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret':
          NODE_ENV === 'production' ? PROD_ADMIN_SECRET : STAGING_ADMIN_SECRET,
      }

      try {
        const response = await axios.post(
          NODE_ENV === 'production' ? PROD_HASURA_URL : STAGING_HASURA_URL,
          { query: checkUserExistenceQuery, variables },
          { headers },
        )

        if (response.data.data.users.length === 0) {
          const data = {
            objects: [
              {
                discord_name: username,
                address: ethereumAddress,
              },
            ],
          }
          const table = 'users'
          const insertUserMutation = `
            mutation insert_${table}($objects: [${table}_insert_input!]!) {
              insert_${table}(objects: $objects) {
                affected_rows
              }
            }
          `

          try {
            const response = await axios.post(
              endpoint,
              { query: insertUserMutation, variables: data },
              { headers },
            )
            message.reply(
              'You are now registered! Now go to the gm channel and type "gm" to get your first badge!',
            )
            const addRole = async () => {
              const member = await message.guild.members.fetch(message.author)
              const role = member.guild.roles.cache.find(
                (r) => r.name === 'Member',
              )
              if (role) {
                await member.roles.add(role)
                console.log(`Added the Registered role to user ${username}`)
              } else {
                console.error('Could not find the Registered role')
              }
            }
            setTimeout(() => {
              addRole()
            }, 2000)
          } catch (error) {
            console.error(error)
          }
        } else {
          message.reply('You are already registered! Get outta here!')
          console.log('User already exists, skipping insert')
        }
      } catch (error) {
        console.error(error)
      }
    } else {
      console.log('No Ethereum address found in message')
    }
  }
})

const mintGm = async ({ recipients, specUri, newStreak, message }) => {
  console.log('🚀 ~ mintGm ~ specUri:', specUri)
  console.log('🚀 ~ mintGm ~ recipients:', recipients)
  try {
    // Call the "airdrop" function on the badges contract
    const gasLimit = 1000000 // Specify the gas limit you want to use
    const tx = await badgesContract.airdrop(recipients, specUri, { gasLimit })
    console.log('🚀 ~ mintGm ~ tx:', tx)

    console.log('🚀 ~ tx submited, waiting...')
    // Wait for the transaction to be mined
    const txRes = await tx.wait()
    console.log('🚀 ~ mintGm ~ txRes:', txRes)
    console.log('tx done, time to update the streak')
    const updateStreakMutation = `
      mutation updateUserStreak($address: String!, $newStreak: Int!) {
        update_users(
          where: { address: { _eq: $address } }
          _set: { streak: $newStreak }
        ) {
          affected_rows
        }
      }
    `

    const variables = {
      address: recipients[0],
      newStreak,
    }
    const headers = {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret':
        NODE_ENV === 'production' ? PROD_ADMIN_SECRET : STAGING_ADMIN_SECRET,
    }

    const response = await axios.post(
      NODE_ENV === 'production' ? PROD_HASURA_URL : STAGING_HASURA_URL,
      { query: updateStreakMutation, variables },
      { headers },
    )
    console.log('🚀 ~ mintGm ~ response.data:', response.data)
    message.reply(
      `Airdrop successful! You can see your badge here: ${getProfileUrl(
        recipients[0],
      )}`,
    )
    // Respond with a success message
    return true
  } catch (error) {
    console.error(error)
    // Respond with an error message
    message.reply(
      'Airdrop failed! You better go complain about it in the #support channel',
    )
    return false
  }
}
const port = process.env.PORT || 3000

// Start the server
app.listen(port, () => {
  console.log('Server listening on port 3000')
})
