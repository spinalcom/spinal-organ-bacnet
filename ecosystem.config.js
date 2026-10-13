const path = require("path");
const { getAllEnvPath, getProcessName } = require("./.envs/index.js");

let allEnvs = getAllEnvPath();

if (allEnvs.length === 0) {
  allEnvs = [path.resolve(__dirname, "./.env")];
}


module.exports = {
  apps: allEnvs.map(envPath => {
    const name = getProcessName(envPath);
    return {
      name,
      script: "./dist/index.js",
      cwd: "./",
      error_file: `./logs/${name}_err.log`,
      out_file: `./logs/${name}_out.log`,
      log_file: `./logs/${name}_combined.log`,
      time: true,
      max_memory_restart: "3G",
      node_args: `--env-file=${envPath} --max-old-space-size=4096`
    }
  })
}









// require("json5/lib/register.js");
// const pm2 = require("pm2");

// const config = require("./src/config.js");
// const name = config.spinalConnector.name;

// module.exports = {
//   apps: [
//     {
//       name,
//       script: "./dist/index.js",
//       cwd: "./",
//       error_file: "./logs/err.log",
//       out_file: "./logs/out.log",
//       log_file: "./logs/combined.log",
//       time: true,
//       max_memory_restart: "3G",
//       node_args: "--max-old-space-size=4096",
//     },
//   ],
// };
