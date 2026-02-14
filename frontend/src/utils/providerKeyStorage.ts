/**
 * Read/write sync key in OAuth provider storage (Google Drive app data, GitHub gist, OneDrive app folder).
 * Used for provider-stored encryption key so the user does not need to remember a passphrase.
 */

const KEY_FILENAME = 'tigement_sync_key'
const GIST_FILENAME = 'tigement_sync_key.txt'

export async function readKeyFromProvider(provider: string, accessToken: string): Promise<string> {
  switch (provider) {
    case 'google':
      return readGoogleDriveAppData(accessToken)
    case 'github':
      return readGitHubGist(accessToken)
    case 'microsoft':
      return readOneDriveAppFolder(accessToken)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

export async function writeKeyToProvider(provider: string, accessToken: string, key: string): Promise<void> {
  switch (provider) {
    case 'google':
      return writeGoogleDriveAppData(accessToken, key)
    case 'github':
      return writeGitHubGist(accessToken, key)
    case 'microsoft':
      return writeOneDriveAppFolder(accessToken, key)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// --- Google Drive App Data ---

async function readGoogleDriveAppData(accessToken: string): Promise<string> {
  const listRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27' + encodeURIComponent(KEY_FILENAME) + '%27', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!listRes.ok) {
    const errBody = await listRes.text()
    let detail = errBody
    try {
      const j = JSON.parse(errBody)
      detail = j?.error?.message || j?.error?.errors?.[0]?.message || errBody
    } catch {
      // use raw errBody
    }
    if (listRes.status === 403 && /has not been used|not been enabled|Access Not Configured/i.test(detail)) {
      throw new Error('Google Drive API is not enabled for this app. Enable "Google Drive API" in Google Cloud Console (APIs & Services) for the project used by Sign in with Google.')
    }
    throw new Error(`Failed to access Google Drive app data: ${detail}`)
  }
  const list = await listRes.json()
  const fileId = list.files?.[0]?.id
  if (!fileId) throw new Error('Sync key not found in Google Drive')
  const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!getRes.ok) throw new Error('Failed to read sync key from Google Drive')
  return getRes.text()
}

async function writeGoogleDriveAppData(accessToken: string, key: string): Promise<void> {
  const listRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!listRes.ok) {
    const errBody = await listRes.text()
    let detail = errBody
    try {
      const j = JSON.parse(errBody)
      detail = j?.error?.message || j?.error?.errors?.[0]?.message || errBody
    } catch {
      // use raw errBody
    }
    if (listRes.status === 403 && /has not been used|not been enabled|Access Not Configured/i.test(detail)) {
      throw new Error('Google Drive API is not enabled for this app. Enable "Google Drive API" in Google Cloud Console (APIs & Services) for the project used by Sign in with Google.')
    }
    throw new Error(`Failed to access Google Drive app data: ${detail}`)
  }
  const list = await listRes.json()
  const existing = list.files?.find((f: { name: string }) => f.name === KEY_FILENAME)
  if (existing) {
    const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
      body: key
    })
    if (!updateRes.ok) throw new Error('Failed to update sync key in Google Drive')
    return
  }
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: KEY_FILENAME, parents: ['appDataFolder'] })
  })
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Failed to create sync key file in Google Drive')
  }
  const file = await createRes.json()
  const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
    body: key
  })
  if (!uploadRes.ok) throw new Error('Failed to write sync key to Google Drive')
}

// --- GitHub Gist ---

async function readGitHubGist(accessToken: string): Promise<string> {
  const res = await fetch('https://api.github.com/gists', {
    headers: { Authorization: `token ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
  })
  if (!res.ok) throw new Error('Failed to list GitHub gists')
  const gists: { id: string; files: Record<string, { filename: string; content?: string }> }[] = await res.json()
  for (const g of gists) {
    const file = g.files?.[GIST_FILENAME] ?? Object.values(g.files || {}).find((f) => f.filename === GIST_FILENAME)
    if (file?.content) return file.content
  }
  throw new Error('Sync key not found in GitHub gists')
}

async function writeGitHubGist(accessToken: string, key: string): Promise<void> {
  const listRes = await fetch('https://api.github.com/gists', {
    headers: { Authorization: `token ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
  })
  if (!listRes.ok) throw new Error('Failed to list GitHub gists')
  const gists: { id: string; files: Record<string, { filename: string }> }[] = await listRes.json()
  const existing = gists.find((g) => Object.values(g.files || {}).some((f) => f.filename === GIST_FILENAME))
  if (existing) {
    const patchRes = await fetch(`https://api.github.com/gists/${existing.id}`, {
      method: 'PATCH',
      headers: { Authorization: `token ${accessToken}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { [GIST_FILENAME]: { content: key } } })
    })
    if (!patchRes.ok) throw new Error('Failed to update sync key gist on GitHub')
    return
  }
  const createRes = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { Authorization: `token ${accessToken}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ public: false, files: { [GIST_FILENAME]: { content: key } } })
  })
  if (!createRes.ok) throw new Error('Failed to create sync key gist on GitHub')
}

// --- Microsoft OneDrive App Folder ---

async function getOneDriveAppRootId(accessToken: string): Promise<string> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) throw new Error('Failed to access OneDrive app folder')
  const data = await res.json()
  if (!data.id) throw new Error('OneDrive app folder not found')
  return data.id
}

async function readOneDriveAppFolder(accessToken: string): Promise<string> {
  const rootId = await getOneDriveAppRootId(accessToken)
  const listRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${rootId}/children`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!listRes.ok) throw new Error('Failed to list OneDrive app folder')
  const list = await listRes.json()
  const file = list.value?.find((f: { name: string }) => f.name === KEY_FILENAME)
  if (!file?.id) throw new Error('Sync key not found in OneDrive')
  const getRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!getRes.ok) throw new Error('Failed to read sync key from OneDrive')
  return getRes.text()
}

async function writeOneDriveAppFolder(accessToken: string, key: string): Promise<void> {
  const rootId = await getOneDriveAppRootId(accessToken)
  const listRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${rootId}/children`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!listRes.ok) throw new Error('Failed to list OneDrive app folder')
  const list = await listRes.json()
  const existing = list.value?.find((f: { name: string }) => f.name === KEY_FILENAME)
  if (existing?.id) {
    const putRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${existing.id}/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
      body: key
    })
    if (!putRes.ok) throw new Error('Failed to update sync key in OneDrive')
    return
  }
  const createRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${rootId}/children/${KEY_FILENAME}/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
    body: key
  })
  if (!createRes.ok) throw new Error('Failed to create sync key in OneDrive')
}
