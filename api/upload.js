export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const { folder, filename, content, email } = req.body || {};
    if (!filename || !content) return res.status(400).send('filename, content required');

    const FOLDER = folder || process.env.DROPBOX_FOLDER_DEFAULT || '/';

    // 1) Refresh Token -> Access Token
    const tokenResp = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.DROPBOX_REFRESH_TOKEN
      }).toString()
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      return res.status(500).send('Failed to refresh Dropbox token: ' + text);
    }
    const tokenJson = await tokenResp.json();
    const accessToken = tokenJson.access_token;

    // 2) Upload content
    const safeFolder = FOLDER.startsWith('/') ? FOLDER : ('/' + FOLDER);
    const path = (safeFolder === '/' ? '' : safeFolder) + '/' + filename;

    const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
          mute: false,
          strict_conflict: false
        })
      },
      body: Buffer.from(content, 'utf8')
    });

    if (!uploadResp.ok) {
      const text = await uploadResp.text();
      return res.status(500).send('Dropbox upload failed: ' + text);
    }

    const uploaded = await uploadResp.json();
    return res.status(200).json(uploaded);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error: ' + (err?.message || err));
  }
}
