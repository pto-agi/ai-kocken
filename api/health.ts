export default function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const envStatus = {
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    CHATKIT_WORKFLOW_ID: Boolean(process.env.CHATKIT_WORKFLOW_ID),
  };

  res.status(200).json({
    ok: envStatus.OPENAI_API_KEY && envStatus.CHATKIT_WORKFLOW_ID,
    time: new Date().toISOString(),
    env: envStatus,
  });
}
