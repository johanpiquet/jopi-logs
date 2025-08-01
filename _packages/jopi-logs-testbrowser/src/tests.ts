import "jopi-node-space";
import {LogInfoLevel} from "jopi-logs";

//await useFilePreset(false);

const logServer = new LogInfoLevel(null, "server");
const logServer_request = new LogInfoLevel(logServer, "request");
logServer_request.info(w => w("Processing request", {path: "/index.html"}));
