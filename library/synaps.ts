const nodeFetch = require('node-fetch')

// Gets all users that have finished.
// Note: Finished does NOT necessarily mean validated!
//       Must check if KYC passed successfully.
const _getFinished = async (apiKey: string) => {
  let data: { session_id: string; alias: string }[]
  try {
    const response = await nodeFetch(
      `https://workflow-api.synaps.io/v2/session/list/FINISHED`,
      {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
        },
      }
    )
    data = await response.json()
  } catch (error) {
    console.error('Unable to fetch data:', error)
  }

  return data
}

// Gets progress of a given session.
// Can use to determine if a particular user successfully passed KYC.
const _getProgress = async (sessionId: string) => {
  let data: { state: string; step: string; step_id: number; app_name: string }[]

  try {
    const response = await nodeFetch(
      `https://workflow-api.synaps.io/v2/workflow/progress`,
      {
        method: 'GET',
        headers: {
          'Session-Id': sessionId,
        },
      }
    )
    data = await response.json()
  } catch (error) {
    console.error('Unable to fetch data:', error)
  }

  return data
}

const getValidated = async (apiKey: string) => {
  // get finished session IDs
  const finishedSessions = (await _getFinished(apiKey)).map(
    (session) => session.session_id
  )

  // get states of all finished sessions
  const sessionStates = (
    await Promise.all(finishedSessions.map((id) => _getProgress(id)))
  ).map((progress) => progress[0].state)

  return sessionStates
}

getValidated(process.env.SYNAPS_API_KEY).then((r) => console.log(r))
