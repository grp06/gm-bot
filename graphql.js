import axios from 'axios'

const endpoint = 'https://decent-vervet-12.hasura.app/v1/graphql'
const { ADMIN_SECRET } = process.env

const checkUserExistence = async (discordName) => {
  console.log('🚀 ~ checkUserExistence ~ discordName:', discordName)
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
    'x-hasura-admin-secret': ADMIN_SECRET,
  }

  try {
    const response = await axios.post(
      endpoint,
      { query, variables },
      { headers },
    )
    const { streak, address, updated_at } = response.data.data.users[0]
    console.log('🚀 ~ checkUserExistence ~ address:', address)
    console.log('🚀 ~ checkUserExistence ~ streak:', streak)
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
    'x-hasura-admin-secret': ADMIN_SECRET,
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

export { checkUserExistence, insertUser }
