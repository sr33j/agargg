import fetch from 'node-fetch';
import { config } from '../config.js';

export function setupAlchemyProxy(app) {
  app.post('/alchemy', async (req, res) => {
    try {
      const response = await fetch(config.alchemyHttpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: 'Proxy request failed',
        details: err.message
      });
    }
  });

  console.log('🔌 Alchemy proxy endpoint configured at /alchemy');
}

export default setupAlchemyProxy;