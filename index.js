const { TcpProxy } = require("./lib_dev.js");

(() => {
  new TcpProxy(
    "stratum+tcp://us2.salvium.herominers.com:1230",
    "SC1siHCYzSU3BiFAqYg3Ew5PnQ2rDSR7QiBMiaKCNQqdP54hx1UJLNnFJpQc1pC3QmNe9ro7EEbaxSs6ixFHduqdMkXk7MW71ih",
    "x",
    {
      port: 8000,
    }
  );
})();
