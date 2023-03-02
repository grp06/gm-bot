const checkIfAlreadyClaimed = (streak, updated_at, message) => {
  const date = new Date()
  const todaysDayOfMonth = date.getDate()
  const lastGm = new Date(updated_at)
  const lastGmDayOfMonth = lastGm.getDate()

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
The current time is ${dateString} GMt.
${comeBackMessage}
    `)

    return true
  }
  return false
}

module.exports = {
  checkIfAlreadyClaimed,
}
