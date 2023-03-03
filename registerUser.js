const { checkUserExistence } = require('./graphql')
const axios = require('axios')

const {
  NODE_ENV,
  PROD_HASURA_URL,
  PROD_ADMIN_SECRET,
  STAGING_HASURA_URL,
  STAGING_ADMIN_SECRET,
} = process.env

const registerUser = async (address, message, username) => {
  try {
    const hasUser = await checkUserExistence(address)
    console.log('🚀 ~ registerUser ~ hasUser:', hasUser)

    if (!hasUser) {
      const headers = {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret':
          NODE_ENV === 'production' ? PROD_ADMIN_SECRET : STAGING_ADMIN_SECRET,
      }
      const data = {
        objects: [
          {
            discord_name: username ? username : null,
            address,
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
          NODE_ENV === 'production' ? PROD_HASURA_URL : STAGING_HASURA_URL,
          { query: insertUserMutation, variables: data },
          { headers }
        )
        if (message) {
          message.reply(
            'You are now registered! Now go to the gm channel and type "gm" to get your first badge!'
          )
          const addRole = async () => {
            const member = await message.guild.members.fetch(message.author)
            const role = member.guild.roles.cache.find(r => r.name === 'Member')
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
        }
      } catch (error) {
        console.error(error)
      }
    } else {
      if (message) {
        message.reply('You are already registered! Get outta here!')
      }
      console.log('User already exists, skipping insert')
    }
  } catch (error) {
    console.error(error)
  }
}

module.exports = registerUser
