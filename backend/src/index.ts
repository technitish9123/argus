import express from 'express';
import dotenv from 'dotenv';
import intentRouter from './routes/intent';
import strategiesRouter from './routes/strategies';
import runsRouter from './routes/runs';
import cors from "cors";


dotenv.config();

const app = express();
app.use(cors());

app.use(express.json());


// POST /intent: Accepts agent strategy JSON and returns a success response

// POST /publish: Accepts strategy JSON and publishes to Akave/Filecoin (S3-compatible)
app.use('/intent', intentRouter);
app.use('/strategies', strategiesRouter);
app.use('/runs', runsRouter);

app.get('/', (req, res) => {
  res.send('Agent backend is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
