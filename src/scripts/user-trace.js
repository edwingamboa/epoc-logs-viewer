import { CsvProcessor, DateProcessor } from "./ultis";

const traceLogsInfo = new Map([
  ['sessionId', { initCol: 0 }],
  ['testerNumber', { initCol: 1 }],
  ['timestamp', { initCol: 2 }],
  ['msElapsedSinceLastEvent', { initCol: 3 }],
  ['action', { initCol: 4 }],
  ['actionD1', {
    initCol: 5,
    values: {
      link: [
        'Link_Orientierung_xpage',
        'Link_Theorie_xpage',
        'Link_Grundprinzip_xpage',
        'Link_Berechnung_xpage',
        'Link_Raue_Oberflächen_xpage',
        'Link_Anwendung_xpage',
        'Link_FAQ_xpage',
        'Link_Zusammenfassung_xpage',
        'Link_Wiederholungsfragen_xpage',
        'Link_Quellen_xpage'
      ]
    }
  }],
  ['actionD2', { initCol: 6 }],
  ['actionD3', { initCol: 7 }]
]);
const DEFAULT_SEGMENT_DISTANCE = 50;

class UserTrace {
  constructor(csv) {
    this.update(csv);
  }

  update(csv, segmentDistance) {
    this.updateLogs(CsvProcessor.extractLines(csv));
    this.updateEvents();
    this.updateSegments(segmentDistance);
  }

  updateLogs(logs) {
    this.logs = logs;
  }

  updateEvents() {
    this.events = this.extractUserTraceEvents(this.logs);
  }

  updateSegments(segmentDistance) {
    this.segments = this.extractSegmentsFromEvents(
      traceLogsInfo.get('actionD1').values.link,
      traceLogsInfo.get('timestamp').initCol,
      traceLogsInfo.get('actionD1').initCol,
      segmentDistance || DEFAULT_SEGMENT_DISTANCE
    );
  }

  extractUserTraceEvents(logs) {
    let events = [];
    logs.forEach(function (line, index) {
      if (line !== '' && index > 0) {
        let columns = CsvProcessor.getColumnsOfCsvLine(line, ';');
        let event = new UserTraceEvent(
          new Date(columns[traceLogsInfo.get('timestamp').initCol]),
          columns[traceLogsInfo.get('action').initCol],
          columns.slice(traceLogsInfo.get('action').initCol).join(' ')
        );
        events.push(event);
      }
    });
    return events;
  }

  extractSegmentsFromEvents (eventsOfInterest, columnOfTime, columnOfEvent, minElapsedSeconds) {
    var segments = [];
    var lastSegmentInitTime;
    var lastSegmentAction;
    var currentSegmentInitTime;
    this.logs.forEach(function (line, index) {
      if (line !== '' && index > 0) {
        var columns = CsvProcessor.getColumnsOfCsvLine(line, ';');
        if (eventsOfInterest.indexOf(columns[columnOfEvent]) > -1) {
          currentSegmentInitTime = new Date(columns[columnOfTime]);
          if (!lastSegmentInitTime) {
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = columns[columnOfEvent];
          }
          if (lastSegmentInitTime &&
            DateProcessor.elapsedSeconds(lastSegmentInitTime, currentSegmentInitTime) >= minElapsedSeconds) {
            segments.push({
              time: lastSegmentInitTime,
              finishTime: currentSegmentInitTime,
              action: lastSegmentAction,
              details: lastSegmentAction + ': ' + DateProcessor.extractTimeHHMMSS(lastSegmentInitTime) +
              ' - ' + DateProcessor.extractTimeHHMMSS(currentSegmentInitTime)
            });
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = columns[columnOfEvent];
          };
        }
      }
    });
    return segments;
  }
}

class UserTraceEvent {
  constructor(time, action, details) {
    this.time = time;
    this.action = action;
    this.details = details;
  }
}

export default UserTrace;