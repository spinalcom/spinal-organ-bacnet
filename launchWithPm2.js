require("json5/lib/register");
const pm2 = require("pm2");

const config = require("./config.json5");
const name = config.spinalConnector.name;


pm2.start({
   name,
   script: "index.js",
   cwd: "./dist/"
})