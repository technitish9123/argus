import { Router } from 'express';

const intentRouter = Router();

intentRouter.post('/', async (req, res) => {
  try {
    const intent = req.body;
    console.log('Received intent:', intent);
    // TODO: Validate and execute intent using agent logic
    res.json({ status: 'received', intent });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default intentRouter;
