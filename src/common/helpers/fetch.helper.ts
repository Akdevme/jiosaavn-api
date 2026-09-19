import { userAgents, type Endpoints } from '#common/constants'
import type { ApiContextEnum } from '#common/enums'

type EndpointValue = (typeof Endpoints)[keyof typeof Endpoints]

interface FetchParams {
  endpoint: EndpointValue
  params: Record<string, string | number>
  context?: ApiContextEnum
}

interface FetchResponse<T> {
  data: T
  ok: Response['ok']
}

export const useFetch = async <T>({
  endpoint,
  params,
  context
}: FetchParams): Promise<FetchResponse<T>> => {
  const url = new URL('https://www.jiosaavn.com/api.php')

  url.searchParams.append('__call', endpoint.toString())
  url.searchParams.append('_format', 'json')
  url.searchParams.append('_marker', '0')
  url.searchParams.append('api_version', '4')
  url.searchParams.append('ctx', context || 'web6dot0')

  Object.keys(params).forEach((key) => {
    url.searchParams.append(key, String(params[key]))
  })

  // TEMPORARY DEBUG:
  // Use the exact same User-Agent locally and on Netlify.
  const userAgent = 'Mozilla/5.0'

  console.log('[UPSTREAM REQUEST]', {
    endpoint,
    params,
    url: url.toString()
  })

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json, text/plain, */*'
    }
  })

  const data = await response.json()

  console.log('[UPSTREAM RESPONSE]', {
    endpoint,
    status: response.status,
    ok: response.ok,
    total: data?.total,
    start: data?.start,
    resultsLength: Array.isArray(data?.results)
      ? data.results.length
      : undefined
  })

  return {
    data: data as T,
    ok: response.ok
  }
}
