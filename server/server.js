// Entry point for `npm start`, locally and on Wasmer Edge.
import { createApp } from "./app.js";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);

createApp().listen(PORT, HOST, () => {
  console.log(`ddp-kids listening on http://${HOST}:${PORT}`);
});
