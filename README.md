# Jopi Logs

## What is Jopi Logs?

Jopi Logs allows you to write logs, i.e., information about what is happening in your program.

This library is designed for browsers, NodeJS, and BunJS. Its goal is to offer a high level of performance, so as not to slow down the application even with a large number of logs.

This performance is achieved in several ways depending on your strategy:
* Delay: logs are not written as they come in, but are grouped and then sent in batches, which reduces I/O.
* WebWorker: logs are processed in a worker, which prevents slowing down the server activity and especially the UI.

## What is great about Jopi Logs?

* Presets for a quick start.
* Use of WebWorker for high performance.
* Automatic archiving of log files to prevent them from becoming too large.
* Automatic deletion of log files older than n days.

## Installation

`jopi-logs` uses `jopi-node-space` internally, which allows it to have the same code for `node.js`, `bun.js`, and the browser. That's why for these three technologies, you only need to import the `jopi-logs` library.

```bash
npm add jopi-logs --save
```

> **TIPS for bun.js**  
> With bun.js, you can do `import "jopi-logs/index.ts"`.
> This will allow you to directly use the TypeScript version and not the JavaScript build.

## Usage

### Logging a message

To write a message, you must first create a *logger*.  
Once done, you can use it as many times as needed.

**File myLoggers.ts** (where we declare our loggers)
```typescript
import {LogInfoLevel} from "jopi-logs";

export const logServer = new LogInfoLevel(null, "server");

// Logger can have a hierarchy. Here this logger is named "server.incomingRequest".
export const logIncomingRequest = new LogInfoLevel(logServer, "incomingRequest");
```

**File myApps.ts** (where we use our loggers)
```typescript
import {logServerProcessing} from "./myLoggers";

// Write a message.
// This message has an optional title and some optional data.
logIncomingRequest.info(w => w("Processing request", {path: "/index.html"}));

// The default printer is the console. It will print:
// info  - Processing request                                |> server.incomingRequest {"path":"/index.html"}
// |       |                                                    |                      |
// |       |-- the title                                        |                      |- the data
// |-- the log level                                            |- the logger name
```

### Setting the log level

There are four log levels: spam, info, warn, and error.
To change the log level, you must use a specific class when creating the logger.

> The log level does not change dynamically.  
> If you need to change a log level, you must modify your source code.  
> This choice allows you to take advantage of dead code elimination by the JavaScript engine.  
> This mechanism will automatically remove code portions if the log level is not enabled.

```typescript
const myParentLogger = null;
const myLoggerName = "server";

const logSpam = LogSpamLevel(myParentLogger, myLoggerName);
const logInfo = LogInfoLevel(myParentLogger, myLoggerName);
const logWarn = LogWarnLevel(myParentLogger, myLoggerName);
const logError = LogErrorLevel(myParentLogger, myLoggerName);
```

### Using a preset

The `useConsolePreset` and `useFilePreset` functions allow you to preconfigure loggers easily.

* **useConsolePreset**: logs to the console, using a WebWorker and a delay.
* **useFilePreset**: logs to a file, using a WebWorker and a delay.

### Changing the LogWriter

By default, logs are written to the console. You can change this behavior by using another writer.
The recommended method is to use a preset. Here the example shows how to do it manually.

This writer is one of the following types:
* Console: writes to the console.
* File: writes to a file.
* Delay: groups log entries, then writes them all at once.
* WebWorker: sends logs to a web worker.

```typescript
// Console writer.
const myConsoleWriter = newConsoleLogWriter();

// Set it as the default writer.
// This will update all the current loggers using the default writer.
setDefaultWriter(myConsoleWriter);

// Here it's a logger using the default writer.
const logServer = new LogInfoLevel(null, "server");

// Here we are forcing it to use a writer.
// If we update the default writer, then logServer will remain unaffected.
logServer.setLogWriter(fileWriter);
```

### Log delay

Writing logs is costly and can significantly slow down the system. That's why it can be useful to group logs and write them all at once (batch). This is what `newLogDelayer` allows, which will accumulate logs and then send them in *batch* mode to write several log entries at once.

```typescript
// Will wait 3 seconds before flushing.
// But will flush immediately if it's an error or a warning.
setDefaultWriter(newLogDelayer(ConsoleLogWriter.getInstance(), {delayTime_sec: 3}));

// You can also use null, to use the current default.
setDefaultWriter(newLogDelayer(null, {delayTime_sec: 3}));
```

### Using a WebWorker

Using a web worker helps reduce system slowdowns caused by writing logs, by delegating processing to a parallel execution flow. This is especially effective if you write to the console, as it can slow down operations a lot.

```typescript
// Will send all the logs to the web worker, whose default is the console writer.
// newWorkerLogWriter can accept a Worker as an argument.
// See: createWorker method to easily create a worker.
//
setDefaultWriter(newWorkerLogWriter());
```

## Available writers

### Writing to the console

It's the default writer, and you have nothing to do to use it.

```typescript
// The default console writer.
const myWriter = newConsoleLogWriter();

// A custom console writer.
//
const formatter = (e: LogEntry) => getLogLevelName(e.level) + " - " + e.title;
const customWriter = newConsoleLogWriter(formatter);
```

### Writing to a file

JopiLogs allows you to write logs to a file, while providing the following features:
* Automatic archiving: the log file is archived when it exceeds a certain size.
* Compression: when archived, the file can be automatically compressed.

```typescript
// Create a writer, where each line is a simple JSON.
// You can also use newFileWriter_dateTypeTitleSourceData.
const fileWriter = newFileWriter_SimpleJson({
    // In which dir do we write the logs?
    // (this dir will automatically be created)
    logDir: "./my/log/dir",
    
    // Log files have a name, to which a prefix and a suffix are added.
    // This prefix is the day date. The suffix is a rotation number.
    fileName: "server",
    
    // Each day it will archive the current log file
    // and replace it with a new one.
    rotate: LogRotate.ON_SIZE,

    // Do a rotation when file size is over 10Mb.
    maxFileSize_mb: 10,
    
    // It will also gzip the file.
    zipArchive: true
});

// Set it as the default writer.
setDefaultWriter(fileWriter);
```

By default, the writer converts all data to JSON and writes this JSON to a file.
If this behavior does not suit you, you can customize how the log is written to the file.

```typescript
const params = {/*...*/};
const formatter = (e: LogEntry) => getLogLevelName(e.level) + " - " + e.title;
const fileWriter = newFileWriter(formatter, params);
```

## Maintenance

### Delete old log files

The `deleteLogsOlderThan_hours` function allows you to automatically delete old log files.
It expects as parameters the folder to monitor and the number of hours after which the log file will be deleted.

> The check is performed when *deleteLogsOlderThan_hours* is called, then every hour.

```typescript
// Will remove files not updated since one month.
deleteLogsOlderThan_hours(24 * 30, "myLogsDir");
```