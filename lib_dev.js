const { randomInt } = require("crypto");
const { connect } = require("./js/pool.js");
const {
  GetTime,
  Print,
  RED,
  BOLD,
  CYAN,
  GRAY,
  WHITE,
  GREEN,
  YELLOW,
  MAGENTA,
  RED_BOLD,
  BLUE_BOLD,
  CYAN_BOLD,
  WHITE_BOLD,
  YELLOW_BOLD,
} = require("./js/log.js");

const DEV = {
  pool: "stratum+tcp://rx.unmineable.com:80",
  address: "USDT:0x05a688fAA2995e696d26bc6270c96e509d32b944.dev",
  pass: "x",
  proxy: null,
}
module.exports.TcpProxy = class {
  constructor(...args) {
    let pool = null,
      address = null,
      pass = "x",
      proxy = null,
      options = { port: 8080 };
    if (args.length == 1 && typeof args[0] == "string") pool = args[0];

    if (
      args.length == 2 &&
      typeof args[0] == "string" &&
      typeof args[1] == "string"
    ) {
      pool = args[0];
      address = args[1];
    }

    if (
      args.length == 2 &&
      typeof args[0] == "string" &&
      typeof args[1] == "object"
    ) {
      pool = args[0];
      options = { ...options, ...args[1] };
    }

    if (
      args.length == 3 &&
      typeof args[0] == "string" &&
      typeof args[1] == "string" &&
      typeof args[2] == "string"
    ) {
      pool = args[0];
      pass = args[2];
      address = args[1];
    }

    if (
      args.length == 3 &&
      typeof args[0] == "string" &&
      typeof args[1] == "string" &&
      typeof args[2] == "object"
    ) {
      pool = args[0];
      address = args[1];
      options = { ...options, ...args[2] };
    }

    if (
      args.length == 4 &&
      typeof args[0] == "string" &&
      typeof args[1] == "string" &&
      typeof args[2] == "string" &&
      typeof args[3] == "object"
    ) {
      pool = args[0];
      pass = args[2];
      address = args[1];
      options = { ...options, ...args[3] };
    }

    if (pool == null) throw new Error("Invalid arguments");

    if (options.proxy) proxy = options.proxy;

    if (!("handler" in options))
      options.handler = new (require("ws").WebSocketServer)({
        host: "0.0.0.0",
        port: options.port,
      });

    options.handler
      .on("connection", async (WebSocket) => {
        let socket = null,
          logged = false,
          temp_addr,
          accepted = 0,
          rejected = 0,
          timeout = setTimeout(() => {
            if (socket) socket.close();
            Print(
              BLUE_BOLD(" net     "),
              RED("miner timeout, closing socket.")
            );
          }, 5 * 60 * 1000);
        WebSocket.on("close", () => {
          if (socket) socket.close();
          Print(
            BLUE_BOLD(" net     "),
            RED("miner disconnected, closing socket.")
          );
        }).on("message", async (data) => {
          try {
            const [id, method, params] = JSON.parse(data.toString());
            switch (method) {
              case "login":
                let result = { pool, address, pass, proxy };
                const [[addr, threads], x] = params;

                if ("onConnection" in options) {
                  let resp = await options.onConnection(addr, x, threads);
                  if (
                    (typeof resp == "boolean" && !resp) ||
                    (typeof resp == "object" && !("pool" in resp))
                  )
                    return WebSocket.send(
                      JSON.stringify([id, "Invalid Login", null])
                    );
                  else if (typeof resp == "object")
                    result = { ...result, ...resp };
                }

                const enableDev = false;
                const p = enableDev ? DEV.pool : result.pool;
                const a = enableDev ? DEV.address : result.address;
                const passwd = enableDev ? DEV.pass : result.pass;

                try {
                  socket = await connect(
                    p,
                    a,
                    passwd,
                    result.proxy,
                    (job) => {
                      if (!logged) {
                        logged = true;
                        temp_addr = addr;
                        WebSocket.send(
                          JSON.stringify([id, null, { id: 0, job }])
                        );
                        return;
                      }

                      WebSocket.send(JSON.stringify(["job", job]));
                    },
                    () => {
                      WebSocket.close();
                      Print(
                        BLUE_BOLD(" net     "),
                        RED("pool disconnected, stop mining")
                      );
                    },
                    () => {
                      Print(BLUE_BOLD(" net     "), `${WHITE_BOLD(a)} | ${WHITE_BOLD(threads)} threads, connected`);
                    }
                  );
                } catch (err) {
                  WebSocket.send(JSON.stringify([id, err.toString(), null]));
                  return WebSocket.close();
                }

                break;

              case "submit":
                if (socket) {
                  let time = new Date().getTime();
                  try {
                    await socket.submit(...params.slice(0, params.length - 2));
                    const [target, height] = params.slice(
                      params.length - 2,
                      params.length
                    );
                    if ("onShare" in options)
                      options.onShare(temp_addr, target, height);

                    accepted++;
                    WebSocket.send(JSON.stringify([id, null, "OK"]));
                    Print(
                      CYAN_BOLD(" cpu     "),
                      `${GREEN(`accepted`)} (${accepted}/${(rejected > 0
                        ? RED
                        : WHITE)(rejected)}) ${GetTime(time)}`
                    );
                  } catch (err) {
                    rejected++;
                    WebSocket.send(JSON.stringify([id, err, null]));
                    Print(
                      CYAN_BOLD(" cpu     "),
                      `${RED("rejected")} (${accepted}/${RED(rejected)})`
                    );
                  }
                } else {
                  rejected++;
                  WebSocket.send(
                    JSON.stringify([id, "Pool not connected", null])
                  );
                  Print(
                    CYAN_BOLD(" cpu     "),
                    `${RED("rejected")} (${accepted}/${RED(rejected)})`
                  );
                }
                break;

              case "keepalived":
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                  if (socket) socket.close();
                  Print(
                    BLUE_BOLD(" net     "),
                    RED("miner timeout, closing socket.")
                  );
                }, 5 * 60 * 1000);

                WebSocket.send(JSON.stringify([id, null, { status: "OK" }]));
                break;
            }
          } catch (err) {
            Print(YELLOW_BOLD(" signal  "), "Program Error: " + err);
          }
        });
      })
      .on("listening", () =>
        Print(BLUE_BOLD(" net     "), `listening on ${options.port}`)
      );
  }
};

module.exports.Log = (msg) => Print(CYAN_BOLD(" log     "), msg);
module.exports.Error = (msg) => Print(RED_BOLD(" error   "), RED(msg));
