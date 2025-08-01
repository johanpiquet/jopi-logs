import "jopi-node-space";
import {deleteLogsOlderThan_hours, LogInfoLevel, useFilePreset} from "jopi-logs";

NodeSpace.app.executeApp(async () => {
    await useFilePreset(true, true);

    const logServer = new LogInfoLevel(null, "server");
    const logServer_request = new LogInfoLevel(logServer, "request");
    logServer_request.info(w => w("Processing request", {path: "/index.html"}));
    logServer_request.warn(w => w("Processing request", {path: "/index.html"}));
    logServer_request.error(w => w("Processing request", {path: "/index.html"}));

    deleteLogsOlderThan_hours(1);
});

