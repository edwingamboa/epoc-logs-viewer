import * as ss from 'simple-statistics';
import { CsvProcessor, DateProcessor, PmProcessor } from './utils';
import { pmLogsInfo, TREND_DATA_HEAD_ROW } from './constants';

const CHANGE_VAL_INDEX_IN_TREND_DATA = 1;

class PerformanceMeasuresTrace {
  constructor (csv, segments) {
    this.update(csv, segments);
  }

  update (csv, segments, desiredPms) {
    this.initSegmentsInfoMap(desiredPms);
    this.segments = segments;
    this.updateLogs(CsvProcessor.extractLines(csv));
    this.updatePerformanceMeasures(desiredPms);
    this.updateTrendData(desiredPms);
  }
  
  initSegmentsInfoMap (desiredPms) {
    desiredPms = desiredPms || pmLogsInfo.get('pmIds');
    this.segmentsInfo = new Map();
    desiredPms.forEach(function (pmId) {
      this.segmentsInfo.set(pmId, []);
    }.bind(this));
  }

  updateLogs (logs) {
    this.logs = logs;
  }

  updatePerformanceMeasures (desiredPms) {
    this.dataWithHeadings = this.extractScaPerformanceMeasures(desiredPms);
  }

  getData (withHeadings) {
    if (withHeadings) {
      return this.dataWithHeadings;
    }
    return this.dataWithHeadings.slice(1);
  }

  getTrendData (pmId, withHeadings) {
    let trendDataWithHeadings = this.trendDataWithHeadings.get(pmId);
    if (withHeadings) {
      return trendDataWithHeadings;
    }
    return trendDataWithHeadings.slice(1);
  }

  updateTrendData (desiredPms) {
    desiredPms = desiredPms || pmLogsInfo.get('pmIds');
    this.trendDataWithHeadings = new Map();
    desiredPms.forEach(function (pmId) {
      this.trendDataWithHeadings.set(pmId, this.calculateTrendDataOfPm(pmId));
    }.bind(this));
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

  calculateTrendDataOfPm (pmId) {
    pmId = pmId || 'SCA_ENG';
    const timeColumnIndex = pmLogsInfo.get('TimeStamp').initCol;
    const columnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;

    var initialPmVal = this.getData()[0][columnIndex];
    var currentPmVal;
    var currentTime;
    var relEngChangeVals = [];

    this.getData().forEach(function (pm) {
      currentTime = pm[timeColumnIndex];
      currentPmVal = pm[columnIndex];
      relEngChangeVals.push([
        currentTime.getTime(),
        parseFloat(this.relativePmChange(currentPmVal, initialPmVal))
      ]);
    }.bind(this));

    var segmentsWithIndexes = this.addIndexesToSegments(this.segments, this.getData(), timeColumnIndex);
    segmentsWithIndexes.forEach(function (segment) {
      if (segment.hasOwnProperty('initIndex')) {
        this.addSegment(relEngChangeVals, segment, pmId);
      }
    }.bind(this));
    return TREND_DATA_HEAD_ROW.concat(relEngChangeVals);
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

  addSegment (relativeChangeData, segment, pmId) {
    let segmentFinalIndex = segment.finishIndex || relativeChangeData.length - 1;
    let initTime;
    let segmentTrendData = relativeChangeData.slice(segment.initIndex, segmentFinalIndex + 1).map(function (data) {
      if (!initTime) {
        initTime = data[0];
      }
      let newData = [];
      newData[0] = DateProcessor.millisecondsToSeconds(data[0] - initTime);
      newData[1] = data[1];
      return newData;
    });
    if (segmentTrendData.length > 1) {
      let trendFunction = ss.linearRegressionLine(ss.linearRegression(segmentTrendData));
      let initTrendValue = trendFunction(segmentTrendData[0][0]);
      let finishTrendValue = trendFunction(segmentTrendData[segmentTrendData.length - 1][0]);
      this.addTrendPointsToSegment(
        relativeChangeData,
        initTrendValue,
        finishTrendValue,
        segment.initIndex,
        segmentFinalIndex,
      );

      segmentTrendData = this.addTrendPointsToSegment(
        segmentTrendData,
        initTrendValue,
        finishTrendValue
      );

      const columnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;

      let segmentData = this.getData().slice(segment.initIndex, segmentFinalIndex + 1);

      let segmentInfo = {
        segment: segment,
        isDesired: this.isDesired(pmId, initTrendValue, finishTrendValue),
        meanChangeValue: this.meanOfData(segmentTrendData, CHANGE_VAL_INDEX_IN_TREND_DATA),
        meanPmValue: this.meanOfData(segmentData, columnIndex),
        maxPmValue: this.maxOfData(segmentData, columnIndex),
        minPmValue: this.minOfData(segmentData, columnIndex),
        spentTime: DateProcessor.elapsedSeconds(segment.time, segment.finishTime),
        trendData: segmentTrendData
      };
      if (segmentInfo.minPmValue === segmentInfo.maxPmValue) {
        segmentInfo.pmIsConstant = true;
      }
      this.segmentsInfo.get(pmId).push(segmentInfo);
    }
  }

  isDesired (pmId, initRelEngChange, finishRelEngChange) {
    let positiveTrend = (finishRelEngChange - initRelEngChange) > 0;
    return !PmProcessor.isNegativeConnoted(pmId) ? positiveTrend : !positiveTrend;
  }

  meanOfData (segmentData, valueIndex) {
    return ss.mean(this.getColumnOfData(segmentData, valueIndex));
  }

  maxOfData (segmentData, valueIndex) {
    return ss.max(this.getColumnOfData(segmentData, valueIndex));
  }

  minOfData (segmentData, valueIndex) {
    return ss.min(this.getColumnOfData(segmentData, valueIndex));
  }

  getColumnOfData (data, columnIndex) {
    let values = [];
    data.forEach(function (data) {
      let value = data[columnIndex];
      if (typeof value === 'string') {
        value = parseFloat(value);
      }
      values.push(value);
    });
    return values;
  }

  getJointSegmentsInfo (pmId) {
    let jointSegmentsActions = [];
    let jointSegmentsInfo = [];
    this.segmentsInfo.get(pmId).forEach(function (segmentInfo, i) {
      let segmentsToJoin = [ segmentInfo ];
      let action = segmentInfo.segment.action;
      this.segmentsInfo.get(pmId).forEach(function (segmentInfoToCompare, j) {
        if (i !== j && segmentInfo.segment.action ===
          segmentInfoToCompare.segment.action &&
          jointSegmentsActions.indexOf(action) < 0) {
          segmentsToJoin.push(segmentInfoToCompare);
        }
      });
      if (segmentsToJoin.length > 1) {
        jointSegmentsInfo.push(this.joinSegmentsInfo(segmentsToJoin, pmId));
        jointSegmentsActions.push(action);
      } else if (jointSegmentsActions.indexOf(action) < 0) {
        jointSegmentsInfo.push(segmentInfo);
      }
    }.bind(this));
    return jointSegmentsInfo;
  }

  joinSegmentsInfo (segmentsInfo, pmId) {
    let segmentTrendData = [];
    let segmentData = [];
    let segmentFinalIndex;
    let segment;
    let jointSegmentsInfo = {};
    let maxPmValue = 0;
    let minPmValue = 1;
    let spentTime = 0;
    let spentTimes = [];
    segmentsInfo.forEach(function (segmentInfo) {
      segment = segmentInfo.segment;
      segmentFinalIndex = segment.finishIndex || this.getData().length - 1;
      segmentTrendData = segmentTrendData.concat(this.getTrendData(pmId).slice(segment.initIndex, segmentFinalIndex + 1));
      segmentData = segmentData.concat(this.getData().slice(segment.initIndex, segmentFinalIndex + 1));
      if (segmentInfo.maxPmValue > maxPmValue) {
        maxPmValue = segmentInfo.maxPmValue;
      }
      if (segmentInfo.minPmValue < minPmValue) {
        minPmValue = segmentInfo.minPmValue;
      }
      spentTime += segmentInfo.spentTime;
      spentTimes.push(spentTime);
    }.bind(this));

    // segmentTrendData
    segmentTrendData = segmentTrendData.map(function (row) {
      return row.slice(0, 2);
    });
    jointSegmentsInfo.trendData = segmentTrendData;

    // isDesired property
    let trendFunction = ss.linearRegressionLine(ss.linearRegression(segmentTrendData));
    let initTrendValue = trendFunction(segmentTrendData[0][0]);
    let finishTrendValue = trendFunction(segmentTrendData[segmentTrendData.length - 1][0]);
    jointSegmentsInfo.isDesired = this.isDesired(pmId, initTrendValue, finishTrendValue);
    // segmentTrendData - setTrendPoints
    jointSegmentsInfo.trendData[0][2] = initTrendValue;
    jointSegmentsInfo.trendData[segmentTrendData.length - 1][2] = finishTrendValue;
    // meanPmValue property
    const columnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;
    jointSegmentsInfo.meanPmValue = this.meanOfData(segmentData, columnIndex);
    // maxPmValue property
    jointSegmentsInfo.maxPmValue = maxPmValue;
    // minPmValue property
    jointSegmentsInfo.minPmValue = minPmValue;
    // spentTime property
    jointSegmentsInfo.spentTime = spentTime;
    // spentTimes property
    jointSegmentsInfo.spentTimes = spentTimes;
    // meanChangeValue property
    jointSegmentsInfo.meanChangeValue = this.meanOfData(segmentTrendData, CHANGE_VAL_INDEX_IN_TREND_DATA);
    // segment property
    jointSegmentsInfo.segment = {
      action: segmentsInfo[0].segment.action,
      details: segmentsInfo[0].segment.details
    };

    if (jointSegmentsInfo.minPmValue === jointSegmentsInfo.maxPmValue) {
      jointSegmentsInfo.pmIsConstant = true;
    }

    return jointSegmentsInfo;
  }

  addTrendPointsToSegment (trendData, initTrendValue, finishTrendValue, segmentInitIndex, segmentFinalIndex) {
    segmentInitIndex = !segmentInitIndex ? 0: segmentInitIndex;
    segmentFinalIndex = !segmentFinalIndex ? trendData.length - 1: segmentFinalIndex;

    trendData[segmentInitIndex][2] = initTrendValue;
    trendData[segmentFinalIndex][2] = finishTrendValue;
    return trendData;
  }

  relativePmChange (currentPm, initialPm) {
    return (currentPm - initialPm) / initialPm;
  }
}

export default PerformanceMeasuresTrace;
