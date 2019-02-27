import * as ss from 'simple-statistics'
import { CsvProcessor, DateProcessor } from "./utils";
import { pmLogsInfo } from './constants'

const CHANGE_VAL_INDEX_IN_TREND_DATA = 1;

class PerformanceMeasuresTrace {

  constructor(csv, segments) {
    this.update(csv, segments);
  }

  update(csv, segments, desiredPms) {
    this.segmentsInfo = [];
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
        this.addSegment(relEngChangeVals, segment, pmId);
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

  addSegment(relativeChangeData, segment, pmId) {
    let segmentFinalIndex = segment.finishIndex || relativeChangeData.length - 1;
    let segmentTrendData = relativeChangeData.slice(segment.initIndex, segmentFinalIndex + 1);
    let trendFunction = ss.linearRegressionLine(ss.linearRegression(segmentTrendData));
    let initTrendValue = trendFunction(relativeChangeData[segment.initIndex][0]);
    let finishTrendValue = trendFunction(relativeChangeData[segmentFinalIndex][0]);
    this.addTrendPointsToSegment(
      relativeChangeData,
      segment.initIndex,
      segmentFinalIndex,
      initTrendValue,
      finishTrendValue
    );

    const columnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;
    
    let segmentInfo = {
      segment: segment,
      isEngaged: this.isEngaged(initTrendValue, finishTrendValue),
      meanChangeValue: this.meanOfData(segmentTrendData, CHANGE_VAL_INDEX_IN_TREND_DATA),
      meanPmValue : this.meanOfData(this.data.slice(segment.initIndex + 1, segmentFinalIndex + 2), columnIndex)
    } 
    this.segmentsInfo.push(segmentInfo);
  }

  isEngaged(initRelEngChange, finishRelEngChange) {
    return (finishRelEngChange - initRelEngChange) > 0;
  }

  meanOfData (segmentData,valueIndex) {
    let values = [];
    segmentData.forEach(function(data) {
      let value = data[valueIndex];
      if (typeof value === 'string') {
        value = parseFloat(value);
      }
      values.push(value)
    });
    return ss.mean(values);
  }

  addTrendPointsToSegment (trendData, segmentInitIndex, segmentFinalIndex, initTrendValue, finishTrendValue) {    
    trendData[segmentInitIndex][2] = initTrendValue;
    trendData[segmentFinalIndex][2] = finishTrendValue;
  }

  relativePmChange (currentPm, initialPm) {
    return (currentPm - initialPm) / initialPm;
  }
}

export default PerformanceMeasuresTrace;