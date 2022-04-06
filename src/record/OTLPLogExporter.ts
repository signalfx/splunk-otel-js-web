import * as protobufjs from "protobufjs/dist/protobuf.js";
import * as logs from "./logs-proto.json";
import { Log } from "./types";

interface OTLPLogExporterConfig {
  headers?: any; //TODO legit type
  beaconUrl: string;
}

const defaultHeaders = {
  "Content-Type": "application/x-protobuf",
};

export default class OTLPLogExporter {
  LogsDataProto: any;
  config: OTLPLogExporterConfig;

  constructor(config: OTLPLogExporterConfig) {
    this.config = config;
    var root = protobufjs.Root.fromJSON(logs);
    this.LogsDataProto = root.lookupType("LogsData");
  }

  constructLogData(logs: Log[]) {
    const resourceLogs = [
      {
        resource: {
          attributes: [
            {
              key: "telemetry.sdk.name",
              value: { stringValue: "webjs" },
            },
          ],
        },
        scopeLogs: [
          {
            scope: {
              name: "webjs.replay",
              version: "0.0.1",
            },
            logRecords: logs,
          },
        ],
      },
    ];

    const logsData = {
      resourceLogs,
    };

    return logsData;
  }

  export(logs: Log[]): void {
    if (logs.length === 0) {
      return;
    }

    const logsData = this.constructLogData(logs);

    var errMsg = this.LogsDataProto.verify(logsData);
    if (errMsg) {
      throw new Error(`Wrong format: ${errMsg}`);
    }

    var message = this.LogsDataProto.create(logsData);
    var buffer = this.LogsDataProto.encode(message).finish();

    const updatedHeaders = this.config.headers
      ? Object.assign({}, defaultHeaders, this.config.headers)
      : defaultHeaders;

    fetch(this.config.beaconUrl, {
      method: "POST",
      body: buffer,
      headers: updatedHeaders,
    });
  }
}
