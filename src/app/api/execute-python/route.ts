import { NextApiRequest, NextApiResponse } from 'next';
import { executePythonCode } from '@/utils/executePython'; // Import the utility function

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { code } = req.body;

  try {
    const result = await executePythonCode(code);

    if (result.error) {
      res.status(400).json({ error: result.error });
    } else {
      res.status(200).json({ output: result.output });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute code' });
  }
}