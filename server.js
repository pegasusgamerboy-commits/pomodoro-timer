import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

if (!process.env.AWS_REGION) { console.error('AWS_REGION missing'); process.exit(1); }
if (!process.env.TABLE_NAME) { console.error('TABLE_NAME missing'); process.exit(1); }

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.send('ok'));

app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.send(new GetCommand({ TableName: TABLE, Key: { pk: 'SETTINGS', sk: 'DEFAULT' } }));
    if (result.Item) {
      res.json(result.Item);
    } else {
      res.json({ workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4, soundEnabled: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { workMinutes, breakMinutes, longBreakMinutes, cyclesBeforeLongBreak, soundEnabled } = req.body;
    const item = { pk: 'SETTINGS', sk: 'DEFAULT', workMinutes, breakMinutes, longBreakMinutes, cyclesBeforeLongBreak, soundEnabled, updatedAt: new Date().toISOString() };
    await db.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const result = await db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': 'SESSIONS' }, ScanIndexForward: false, Limit: 50 }));
    res.json(result.Items || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { type, durationMinutes, completedAt } = req.body;
    const id = Date.now().toString();
    const item = { pk: 'SESSIONS', sk: 'SESSION#' + id, type, durationMinutes, completedAt, createdAt: new Date().toISOString() };
    await db.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
