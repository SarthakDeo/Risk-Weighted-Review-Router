import { buildApp } from './api/server.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Risk scoring service listening on http://localhost:${port}`);
});
