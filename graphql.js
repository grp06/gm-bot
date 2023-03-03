const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config()

const {
  PROD_ADMIN_SECRET,
  STAGING_ADMIN_SECRET,
  NODE_ENV,
  PROD_HASURA_URL,
  STAGING_HASURA_URL,
} = process.env

const endpoint =
  NODE_ENV === 'production' ? PROD_HASURA_URL : STAGING_HASURA_URL

const checkUserExistence = async (discordName) => {
  const query = `
    query checkUserExistence($discordName: String!) {
        users(where: { discord_name: { _eq: $discordName } }) {
          streak
          address
          updated_at
        }
    }
  `
  const variables = {
    discordName,
  }
  const headers = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret':
      NODE_ENV === 'production' ? PROD_ADMIN_SECRET : STAGING_ADMIN_SECRET,
  }

  try {
    const response = await axios.post(
      NODE_ENV === 'production' ? PROD_HASURA_URL : STAGING_HASURA_URL,
      { query, variables },
      { headers },
    )
    const { streak, address, updated_at } = response.data.data.users[0]
    console.log('🚀 ~ checkUserExistence ~ streak:', streak)
    console.log('🚀 ~ checkUserExistence ~ address:', address)
    console.log('🚀 ~ checkUserExistence ~ updated_at:', updated_at)
    return { streak, address, updated_at }
  } catch (error) {
    console.error(error)
    return []
  }
}

const insertUser = async (discordName, ethereumAddress) => {
  const data = {
    objects: [
      {
        discord_name: discordName,
        address: ethereumAddress,
      },
    ],
  }
  const table = 'users'
  const query = `
    mutation insert_${table}($objects: [${table}_insert_input!]!) {
      insert_${table}(objects: $objects) {
        affected_rows
      }
    }
  `
  const variables = { objects: data }
  const headers = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret':
      NODE_ENV === 'production' ? PROD_ADMIN_SECRET : STAGING_ADMIN_SECRET,
  }

  try {
    const response = await axios.post(
      endpoint,
      { query, variables },
      { headers },
    )
    console.log(response.data)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

module.exports = {
  checkUserExistence,
  insertUser,
}
