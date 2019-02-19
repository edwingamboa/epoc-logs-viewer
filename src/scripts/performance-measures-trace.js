import * as ss from 'simple-statistics'
import { CsvProcessor, DateProcessor } from "./utils";
import { pmLogsInfo } from './constants'

class PerformanceMeasuresTrace {

  constructor(csv, segments) {
    this.update(csv, segments);
  }

  update(csv, segments, desiredPms) {
    this.updateLogs(CsvProcessor.extractLines(csv));
    this.updatePerformanceMeasures(desiredPms);
    this.updateTrendDate(segments);
  }

  updateLogs(logs) {
    this.logs = logs;
  }

  updatePerformanceMeasures(desiredPms) {
    this.data = this.extractScaPerformanceMeasures(desiredPms);
  }

  updateTrendDate(segments) {
    this.trendData = this.calculateTrendDataOfPm(segments);
  }

  extractScaPerformanceMeasures (desiredPms) {
    var data = [];
    desiredPms = desiredPms || pmLogsInfo.get('pmIds');
    this.logs.forEach(function (line, i) {
      if (line !== '') {
        var columns = CsvProcessor.getColumnsOfCsvLine(line);
        var performanceMeasure = [];
        if (i > 0) {
          performanceMeasure.push(
            DateProcessor.dateBasedOnTimeStampMs(columns[pmLogsInfo.get('TimeStamp').initCol])
          );
          desiredPms.forEach(function (pm) {
            performanceMeasure.push(columns[pmLogsInfo.get(pm).initCol]);
            pmLogsInfo.get(pm).newCol = performanceMeasure.length - 1;
          });
        } else {
          performanceMeasure.push('TimeStamp');
          desiredPms.forEach(function (pm) {
            performanceMeasure.push(pm + ' ' + pmLogsInfo.get(pm).verbose);
          });
        }
        data.push(performanceMeasure);
      }
    });
    return data;
  }

  calculateTrendDataOfPm (segments, pmId) {
    pmId = pmId || 'SCA_ENG';
    const timeColumnIndex = pmLogsInfo.get('TimeStamp').initCol;
    const columnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;

    var initialPmVal = this.data[1][columnIndex];
    var currentPmVal;
    var currentTime;
    var relEngChangeVals = [];

    this.data.slice(1).forEach(function (pm) {
      currentTime = pm[timeColumnIndex];
      currentPmVal = pm[columnIndex];
      relEngChangeVals.push([
        currentTime.getTime(),
        parseFloat(this.relativePmChange(currentPmVal, initialPmVal))
      ]);
    }.bind(this));

    var segmentsWithIndexes = this.addIndexesToSegments(segments, this.data.slice(1), timeColumnIndex);
    segmentsWithIndexes.forEach(function (segment) {
      if (segment.hasOwnProperty('initIndex')) {
        this.addTrendPoints(relEngChangeVals, segment.initIndex, segment.finishIndex || relEngChangeVals.length - 1);
      }
    }.bind(this));
    return [['TimeStamp', 'Relative Change', 'Trend']].concat(relEngChangeVals);
  }

  addIndexesToSegments (segments, pmList, timeColumnIndex) {
    var pmListIndex = 0;
    segments.map(function (segment, i) {
      while (pmListIndex < pmList.length &&
        segment.time > pmList[pmListIndex][timeColumnIndex]) {
        pmListIndex++;
      }
      if (pmListIndex < pmList.length) {
        segment.initIndex = pmListIndex;
        if (i > 0) {
          segments[i - 1].finishIndex = pmListIndex - 1;
        }
      }
      return segment;
    });
    return segments;
  }

  addTrendPoints (data, segmentInitIndex, segmentFinalIndex) {
    var f = ss.linearRegressionLine(ss.linearRegression(data.slice(segmentInitIndex, segmentFinalIndex + 1)));
    data[segmentInitIndex][2] = f(data[segmentInitIndex][0]);
    data[segmentFinalIndex][2] = f(data[segmentFinalIndex][0]);
  }

  relativePmChange (currentPm, initialPm) {
    return (currentPm - initialPm) / initialPm;
  }
}

export default PerformanceMeasuresTrace;