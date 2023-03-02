const ethers = require('ethers')
const express = require('express')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const { Client, GatewayIntentBits } = require('discord.js')
const axios = require('axios')
dotenv.config()

const endpoint = 'https://decent-vervet-12.hasura.app/v1/graphql'

const badgeUris = [
  'bafyreidbup5ra5y3wb3ulls4stbghlihxhpwsxb63wl32tzvhkpk7i5pba',
  'bafyreic6wh2xb6awucsmmssem5qkjhexlnziw3bv4tcgzxargsiorxsq34',
]

const getProfileUrl = (address) => {
  return `https://staging.otterspace.xyz/${address}`
}

// Replace these contract addresses with your own
const {
  BADGES_CONTRACT,
  DEPLOYER_PRIVATE_KEY,
  ALCHEMY_API_KEY,
  ADMIN_SECRET,
} = process.env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.login(process.env.DISCORD_TOKEN)

// Initialize the ethers provider and signer
// Set up the Alchemy provider
const provider = ethers.getDefaultProvider(
  'https://eth-goerli.g.alchemy.com/v2/2bJVK5JAlpGcV1JxYj6N56d-TJYa2Mrr',
  {
    alchemy: ALCHEMY_API_KEY,
  },
)

const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)

// Initialize the badges contract interface
const badgesContract = new ethers.Contract(
  BADGES_CONTRACT,
  ['function airdrop(address[] recipients, string specUri) public'],
  signer,
)

// Initialize the express app
const app = express()

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }))

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`)
})

client.on('messageCreate', async (message) => {
  if (message.content.includes('gm')) {
    try {
      // pull the discord id from the message
      const discord_name = message.author.username
      if (discord_name === 'gm-bot') return
      console.log('🚀 ~ client.on ~ discord_name:', discord_name)
      // query the database to get their streak

      const variables = {
        discordName: discord_name,
      }
      const headers = {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': ADMIN_SECRET,
      }
      const checkUserExistenceQuery = `
        query checkUserExistence($discordName: String!) {
          users(where: { discord_name: { _eq: $discordName } }) {
            streak
            address
            updated_at
          }
        }
      `
      const response = await axios.post(
        endpoint,
        { query: checkUserExistenceQuery, variables },
        { headers },
      )
      console.log('🚀 ~ client.on ~ response.data:', response.data)
      const { streak, address, updated_at } = response.data.data.users[0]
      const date = new Date()
      const todaysDayOfMonth = date.getDate()
      const lastGm = new Date(updated_at)
      const lastGmDayOfMonth = lastGm.getDate()
      console.log('🚀 ~ client.on ~ lastGmDayOfMonth:', lastGmDayOfMonth)

      if (todaysDayOfMonth === lastGmDayOfMonth && streak !== 0) {
        const date = new Date()
        const options = {
          timeZone: 'GMT',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        }
        const dateString = date.toLocaleString('en-US', options)
        console.log(dateString) // Output: 'March 1, 2023, 4:34:56 PM GMT'
        const now = Date.now()
        const nextDayUtc = new Date(now)
        nextDayUtc.setUTCHours(24, 0, 0, 0) // set to midnight UTC
        const durationUntilNextDay = nextDayUtc.getTime() - now
        const hoursUntilNextDay = Math.floor(
          durationUntilNextDay / (1000 * 60 * 60),
        )
        const minutesUntilNextDay = Math.ceil(
          (durationUntilNextDay / (1000 * 60)) % 60,
        )
        const comeBackMessage = `Come back in ${
          hoursUntilNextDay > 0
            ? `${hoursUntilNextDay} ${
                hoursUntilNextDay === 1 ? 'hour' : 'hours'
              } and `
            : ''
        }${minutesUntilNextDay} ${
          minutesUntilNextDay === 1 ? 'minute' : 'minutes'
        } to continue your streak and claim your next badge.`

        message.reply(`You already got your badge for today!
The current time is ${dateString} GMT (GMT is our favorite timezone).
${comeBackMessage}
`)

        return
      }
      const hardCodedStreak = `ipfs://bafyreib7fdsb2ypwyn3spxspodjubiuj5ldigfmfimqtb23a6gtzbqpeve/metadata.json`
      // specUri: `ipfs://${badgeUris[streak]}/metadata.json`,
      message.reply(`Your current streak is ${streak}, I'm airdropping you a badge to celebrate!

I'll send you another message in about 15 seconds with a link!
            `)

      await mintGm({
        recipients: [address],
        specUri: hardCodedStreak,
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
        'x-hasura-admin-secret': ADMIN_SECRET,
      }

      try {
        const response = await axios.post(
          endpoint,
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
            console.log(response.data)
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
            }, 3000)
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
  try {
    // Call the "airdrop" function on the badges contract
    const tx = await badgesContract.airdrop(recipients, specUri)
    console.log('🚀 ~ tx submited, waiting...')
    // Wait for the transaction to be mined
    await tx.wait()
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
      'x-hasura-admin-secret': ADMIN_SECRET,
    }

    const response = await axios.post(
      endpoint,
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
// Start the server
app.listen(3000, () => {
  console.log('Server listening on port 3000')
})
