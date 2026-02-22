export default function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const envStatus = {
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    OPENAI_CHAT_MODEL: Boolean(process.env.OPENAI_CHAT_MODEL),
    MCP_SERVER_URL: Boolean(process.env.MCP_SERVER_URL),
  };

  res.status(200).json({
    ok: envStatus.OPENAI_API_KEY,
    time: new Date().toISOString(),
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      deployment: process.env.VERCEL_URL || null,
    },
    env: envStatus,
  });
}
