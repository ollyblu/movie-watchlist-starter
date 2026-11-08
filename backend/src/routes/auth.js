import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { loginBody, registerBody } from './schemas.js';

export function createAuthRouter({ authService }) {
  const router = Router();

  router.post('/register', validate({ body: registerBody }), async (req, res) => {
    const user = await authService.register(req.valid.body);
    res.status(201).json({ user });
  });

  router.post('/login', validate({ body: loginBody }), async (req, res) => {
    res.json(await authService.login(req.valid.body));
  });

  return router;
}
