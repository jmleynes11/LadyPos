import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectDB } from "./config/config.js";

dotenv.config();
const app = createApp();
const port = Number(process.env.PORT || 5001);
app.listen(port, () => {
  connectDB();
  console.log(`Server is listening on port http://localhost:${port}`);
});
