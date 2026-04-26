// Servidor Next.js custom + Socket.io.
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as IoServer } from "socket.io";
import { registerSocket } from "./src/server/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });
  const io = new IoServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  registerSocket(io);
  httpServer.listen(port, () => {
    console.log(`> Truco entre Primos en http://${hostname}:${port}`);
  });
});
