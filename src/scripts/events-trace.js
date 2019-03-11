import { CsvProcessor, DateProcessor } from './utils';
import { segmentsOfInterest, DEFAULT_SEGMENT_DISTANCE } from './constants';

const traceLogsInfo = new Map([
  ['sessionId', { initCol: 0 }],
  ['testerNumber', { initCol: 1 }],
  ['timestamp', { initCol: 2 }],
  ['msElapsedSinceLastEvent', { initCol: 3 }],
  ['action', { initCol: 4 }],
  ['actionD1', { initCol: 5 }],
  ['actionD2', { initCol: 6 }],
  ['actionD3', { initCol: 7 }]
]);

class EventsTrace {
  constructor (csv, segmentDistance) {
    this.update(csv, segmentDistance);
  }

  update (csv, segmentDistance) {
    this.updateLogs(CsvProcessor.extractLines(csv));
    this.updateEvents();
    this.updateSegmentsDistance(segmentDistance);
  }

  updateLogs (logs) {
    this.logs = logs;
  }

  updateEvents () {
    this.events = this.extractUserTraceEvents(this.logs);
  }

  updateSegmentsDistance (segmentDistance) {
    this.segments = this.extractSegmentsFromEvents(
      segmentsOfInterest,
      traceLogsInfo.get('timestamp').initCol,
      segmentDistance || DEFAULT_SEGMENT_DISTANCE
    );
  }

  extractUserTraceEvents (logs) {
    let events = [];
    logs.forEach(function (line, index) {
      if (line !== '' && index > 0) {
        let columns = CsvProcessor.getColumnsOfCsvLine(line, ';');
        let event = new Event(
          new Date(columns[traceLogsInfo.get('timestamp').initCol]),
          columns[traceLogsInfo.get('action').initCol],
          columns.slice(traceLogsInfo.get('action').initCol).join(' ')
        );
        events.push(event);
      }
    });
    return events;
  }

  generateSegmentAction (columns) {
    let columnOfEvent = traceLogsInfo.get('actionD1').initCol;
    let columnOfEventSuffix = traceLogsInfo.get('actionD2').initCol;
    let segmentAction = columns[columnOfEvent];
    if (columns.length >= (columnOfEventSuffix + 1) &&
      columns[columnOfEventSuffix] !== '') {
      segmentAction += `_${columns[columnOfEventSuffix]}`;
    }
    return segmentAction;
  }

  extractSegmentsFromEvents (eventsOfInterest, columnOfTime, minElapsedSeconds) {
    var segments = [];
    var lastSegmentInitTime;
    var lastSegmentAction;
    var currentSegmentInitTime;
    var columns;
    let segmentAction;
    this.logs.forEach(function (line, index) {
      if (line !== '' && index > 0) {
        line = line.replace(/\r?\n|\r/, '');
        columns = CsvProcessor.getColumnsOfCsvLine(line, ';');
        segmentAction = this.generateSegmentAction(columns);
        if (eventsOfInterest.indexOf(segmentAction) > -1) {
          currentSegmentInitTime = new Date(columns[columnOfTime]);
          if (!lastSegmentInitTime) {
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = segmentAction;
          }
          if (lastSegmentInitTime &&
            DateProcessor.elapsedSeconds(lastSegmentInitTime, currentSegmentInitTime) >= minElapsedSeconds) {
            segments.push(new Segment(lastSegmentInitTime, currentSegmentInitTime, lastSegmentAction));
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = segmentAction;
          };
        }
      }
    }.bind(this));
    // Add last identified segment
    let lastSegmentFinishTime = new Date(columns[columnOfTime]);
    segments.push(new Segment(lastSegmentInitTime, lastSegmentFinishTime, lastSegmentAction));
    return segments;
  }
}

class Segment {
  constructor (initTime, finishTime, action) {
    this.time = initTime;
    this.finishTime = finishTime;
    this.action = action;
    this.details = action + ':' + DateProcessor.extractTimeHHMMSS(initTime) +
    ' - ' + DateProcessor.extractTimeHHMMSS(finishTime);
  }
}

class Event {
  constructor (time, action, details) {
    this.time = time;
    this.action = action;
    this.details = details;
  }
}

export default EventsTrace;
