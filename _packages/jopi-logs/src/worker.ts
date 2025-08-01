import {newConsoleLogWriter, newFileWriter_dateTypeTitleSourceData, setDefaultWriter} from "./core.ts";
import type {FileLogWriterParams} from "./common.ts";

const workerData = NodeSpace.thread.getCurrentWorkerData();

if (workerData.useConsole) {
    setDefaultWriter(newConsoleLogWriter());
} else if (workerData.useFile) {
    const fileParams = workerData!.params as FileLogWriterParams;
    setDefaultWriter(newFileWriter_dateTypeTitleSourceData(fileParams))
}