const net = require("net");
const fs = require("fs");
const ps = require("path");

const server = net.createServer();

const CODE = {
  404: "HTTP/1.1 404 Not Found\r\n",
  200: "HTTP/1.1 200 OK\r\n",
  201: "HTTP/1.1 201 Created\r\n",
};

// Fonction pour parser la requête HTTP
const HTTPparser = async (req) => {
  const lines = req.split("\r\n");
  const statusLine = lines[0].split(" ");
  const method = statusLine[0];
  const requestPath = statusLine[1];
  const body = lines[lines.length - 1];

  const httpParsed = {
    statusLine: statusLine,
    header: "",
    body: "",
    code: 404,
    contentLength: 0,
    contentType: "",
  };

  if (method === "GET") {
    // Détermine la validité de la requête et extrait le corps si nécessaire
    if (requestPath && requestPath.startsWith("/echo/")) {
      httpParsed.body = requestPath.substring(6); // Supprime /echo/
      httpParsed.code = 200;
      httpParsed.contentType = "text/plain";
    } else if (requestPath === "/") {
      httpParsed.code = 200; // Le chemin racine est valide
      httpParsed.contentType = "text/plain";
    } else if (requestPath && requestPath.startsWith("/user-agent")) {
      if (lines.length > 2) {
        const userAgent = lines[2].split(" ");
        if (userAgent.length > 1) {
          const userAgentBody = userAgent[1];
          httpParsed.body = userAgentBody;
          httpParsed.contentType = "text/plain";
          httpParsed.code = 200;
        }
      }
    } else if (
      requestPath &&
      requestPath.startsWith("/files") &&
      process.argv[2] === "--directory"
    ) {
      const basePath = process.argv[3];
      const fullPath = ps.join(basePath, requestPath.substring(7));
      try {
        const data = await fs.promises.readFile(fullPath, "utf-8");
        httpParsed.code = 200;
        httpParsed.contentType = "application/octet-stream";
        httpParsed.body = data;
      } catch (err) {
        httpParsed.code = 404;
      }
    }
  }

  if (method === "POST") {
    if (requestPath.startsWith("/files")) {
      const basePath = process.argv[3] || "./";
      const fullPath = ps.join(basePath, requestPath.substring(7));

      try {
        await fs.promises.writeFile(fullPath, body);
        httpParsed.code = 201;
        httpParsed.contentType = "text/plain";
      } catch (err) {
        httpParsed.code = 500;
      }
    }
  }

  httpParsed.contentLength = httpParsed.body.length;

  return httpParsed;
};

// Gestion des connexions au serveur
server.on("connection", (socket) => {
  socket.setKeepAlive(true);

  // Gestion des données reçues du client
  socket.on("data", async (data) => {
    const httpParsed = await HTTPparser(data.toString()); // Parsing de la requête
    const header = `Content-Type: ${httpParsed.contentType}\r\nContent-Length: ${httpParsed.contentLength}\r\n\r\n`;
    const body = httpParsed.body;

    // Envoie la réponse appropriée
    socket.write(CODE[`${httpParsed.code}`]);
    socket.write(header);
    if (httpParsed.code !== 404) {
      socket.write(body);
    }
    socket.end(); // Ferme la connexion
  });
});

// Le serveur écoute sur le port 4221
server.listen(4221, "localhost", () => {
  console.log("Listening on port : 4221");
});
