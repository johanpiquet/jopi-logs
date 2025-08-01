/*import "jopi-node-space";
import {deleteLogsOlderThan_hours, LogInfoLevel, useFilePreset} from "./core.ts";

NodeSpace.app.executeApp(async () => {
    await useFilePreset(false, true);

    const logServer = new LogInfoLevel(null, "server");
    const logServer_request = new LogInfoLevel(logServer, "request");
    logServer_request.info(w => w("Processing request", {path: "/index.html"}));
    logServer_request.warn(w => w("Processing request", {path: "/index.html"}));
    logServer_request.error(w => w("Processing request", {path: "/index.html"}));

    deleteLogsOlderThan_hours(1);
});*/

import "jopi-node-space";
import {LogInfoLevel} from "jopi-logs";

const logServer = new LogInfoLevel(null, "server");
const logServer_request = new LogInfoLevel(logServer, "request");
logServer_request.info(w => w("Processing request", {path: "/index.html"}));
