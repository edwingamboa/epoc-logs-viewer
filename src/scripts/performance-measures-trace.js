import * as ss from 'simple-statistics';
import { CsvProcessor, DateProcessor, PmProcessor, DataProcessor, NumberProcessor } from './utils';
import { pmLogsInfo } from './constants';
import { Segment } from './events-trace';

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

  updateSegments (segments, desiredPms) {
    this.segments = segments;
    this.initSegmentsInfoMap(desiredPms);
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

  getChangeValueData (pmId) {
    let changeValueData = [];
    this.segmentsInfo.get(pmId).forEach(function (segmentInfo) {
      changeValueData = changeValueData.concat(segmentInfo.trendData);
    });
    return changeValueData;
  }

  updateTrendData (desiredPms) {
    desiredPms = desiredPms || pmLogsInfo.get('pmIds');
    desiredPms.forEach(function (pmId) {
      this.calculateTrendDataOfPm(pmId);
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

    let initialPmVal;
    let currentPmVal;
    let currentTime;
    let relEngChangeVals;
    let segmentData;
    let segmentFinalIndex;
    let relChangeValue;
    let segmentsWithIndexes = this.addIndexesToSegments(this.segments, this.getData(), timeColumnIndex);
    segmentsWithIndexes.forEach(function (segment) {
      relEngChangeVals = [];
      if (segment.hasOwnProperty('initIndex')) {
        segmentFinalIndex = segment.finishIndex || this.getData().length - 1;
        segmentData = this.getData().slice(segment.initIndex, segmentFinalIndex + 1);
        initialPmVal = segmentData[0][columnIndex];
        segmentData.forEach(function (pm) {
          currentTime = pm[timeColumnIndex];
          currentPmVal = pm[columnIndex];
          relChangeValue = {};
          relChangeValue.time = currentTime.getTime();
          relChangeValue[DataProcessor.generateRelChangeValueKey(segment.action)] = parseFloat(this.relativePmChange(currentPmVal, initialPmVal));
          relEngChangeVals.push(relChangeValue);
        }.bind(this));
        this.addSegment(relEngChangeVals, segment, pmId);
      }
    }.bind(this));
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
          segments[i - 1].finishIndex = pmListIndex > segments[i - 1].initIndex ? pmListIndex - 1 : pmListIndex;
        }
      }
      return segment;
    });
    return segments;
  }

  addSegment (relativeChangeData, segment, pmId) {
    if (relativeChangeData.length > 1) {
      let segmentFinalIndex = segment.finishIndex || this.getData().length - 1;
      let relChangeValKey = DataProcessor.generateRelChangeValueKey(segment.action);
      let segmentTrendDataInSeconds = DataProcessor.getDataAsArrayInSeconds(relativeChangeData, relChangeValKey);
      let trendValKey = DataProcessor.generateTrendValueKey(segment.action);
      let trendFunction = ss.linearRegressionLine(ss.linearRegression(segmentTrendDataInSeconds));
      let initTrendValue = trendFunction(segmentTrendDataInSeconds[0][0]);
      let finishTrendValue = trendFunction(segmentTrendDataInSeconds[relativeChangeData.length - 1][0]);
      relativeChangeData = this.addTrendPointsToSegment(
        relativeChangeData,
        trendValKey,
        initTrendValue,
        finishTrendValue
      );

      const pmColumnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;

      let segmentData = this.getData().slice(segment.initIndex, segmentFinalIndex + 1);
      let pmValues = DataProcessor.getColumnOfData(segmentData, pmColumnIndex);
      let changeValues = DataProcessor.getColumnOfData(segmentData, CHANGE_VAL_INDEX_IN_TREND_DATA);
      
      let segmentInfo = new SegmentInfo(segment, pmValues, changeValues, relativeChangeData, pmId);
      this.segmentsInfo.get(pmId).push(segmentInfo);
    }
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
    let spentTimes = [];
    let spentTime = 0;
    let refSegment = new Segment (segmentsInfo[0].segment.action);
    let trendValKey = DataProcessor.generateTrendValueKey(refSegment.action);
    let userRatings = [];
    segmentsInfo.forEach(function (segmentInfo) {
      segmentFinalIndex = segmentInfo.segment.finishIndex || this.getData().length - 1;
      segmentTrendData = segmentTrendData.concat(this.removeTrendPointsOfSegmentData(segmentInfo.trendData, trendValKey));
      segmentData = segmentData.concat(this.getData().slice(segmentInfo.segment.initIndex, segmentFinalIndex + 1));
      spentTime += segmentInfo.spentTime;
      spentTimes.push(spentTime);
      userRatings = userRatings.concat(segmentInfo.userRatings);
    }.bind(this));
    // user Ratings
    refSegment.setUserRatings(userRatings);

    // segmentTrendData
    let relChangeValKey = DataProcessor.generateRelChangeValueKey(refSegment.action);
    let segmentTrendDataInSeconds = DataProcessor.getDataAsArrayInSeconds(segmentTrendData, relChangeValKey);
    let trendFunction = ss.linearRegressionLine(ss.linearRegression(segmentTrendDataInSeconds));
    let initTrendValue = trendFunction(segmentTrendDataInSeconds[0][0]);
    let finishTrendValue = trendFunction(segmentTrendDataInSeconds[segmentTrendDataInSeconds.length - 1][0]);
    // segmentTrendData - setTrendPoints
    segmentTrendData = this.addTrendPointsToSegment(segmentTrendData, trendValKey, initTrendValue, finishTrendValue);

    const pmColumnIndex = pmLogsInfo.get(pmId).newCol || pmLogsInfo.get(pmId).initCol;
    let pmValues = DataProcessor.getColumnOfData(segmentData, pmColumnIndex);
    let changeValues = DataProcessor.getColumnOfData(segmentTrendData, CHANGE_VAL_INDEX_IN_TREND_DATA);

    let jointSegmentsInfo = new SegmentInfo(refSegment, pmValues, changeValues, segmentTrendData, pmId);
    jointSegmentsInfo.spentTime = spentTime;
    jointSegmentsInfo.spentTimes = spentTimes;

    return jointSegmentsInfo;
  }

  removeTrendPointsOfSegmentData (data, trendPointKey) {
    let newData = [...data]
    delete newData[0][trendPointKey]
    delete newData[data.length - 1][trendPointKey]
    return newData;
  }

  addTrendPointsToSegment (trendData, trendValKey, initTrendValue, finishTrendValue, segmentInitIndex, segmentFinalIndex) {
    segmentInitIndex = !segmentInitIndex ? 0: segmentInitIndex;
    segmentFinalIndex = !segmentFinalIndex ? trendData.length - 1: segmentFinalIndex;

    trendData[segmentInitIndex][trendValKey] = initTrendValue;
    trendData[segmentFinalIndex][trendValKey] = finishTrendValue;
    return trendData;
  }

  relativePmChange (currentPm, initialPm) {
    return (currentPm - initialPm) / initialPm;
  }
}

class SegmentInfo {
  constructor(segment, pmValues, changeValues, segmentTrendData, pmId) {
    this.segment = segment;
    if (segment.hasOwnProperty('time') && segment.hasOwnProperty('finishTime')) {
      this.spentTime = DateProcessor.elapsedSeconds(segment.time, segment.finishTime);
    }
    this.pmId = pmId;
    this.meanChangeValue = ss.mean(changeValues);
    this.meanPmValue = ss.mean(pmValues);
    this.maxPmValue = ss.max(pmValues),
    this.minPmValue = ss.min(pmValues),
    this.trendData = segmentTrendData;
  }

  isDesired() {
    let positiveTrend = (this.finishTrendValue - this.initTrendValue) > 0;
    return !PmProcessor.isNegativeConnoted(this.pmId) ? positiveTrend : !positiveTrend;
  }

  pmIsConstant () {
    return this.minPmValue === this.maxPmValue;
  }

  get userRatings () {
    return this.segment.userRatings;
  }

  get segmentName () {
    return this.segment.action;
  }

  get initTrendValue () {
    return this.trendData[0][DataProcessor.generateTrendValueKey(this.segment.action)];
  }

  get finishTrendValue () {
    return this.trendData[this.trendData.length - 1][DataProcessor.generateTrendValueKey(this.segment.action)];
  }

  get initTime () {
    return new Date(this.trendData[0].time);
  }

  get finishTime () {
    return new Date(this.trendData[this.trendData.length - 1].time);
  }

  get details () {
    const numberOfDecimals = 5;
    const defaultNumberOfVisits = 1
    return [
      { label: `Mean ${this.pmId}`, value: NumberProcessor.round(this.meanPmValue, numberOfDecimals) },
      { label: `Max ${this.pmId}`, value: NumberProcessor.round(this.maxPmValue, numberOfDecimals) },
      { label: `Min ${this.pmId}`, value: NumberProcessor.round(this.minPmValue, numberOfDecimals) },
      { label: 'Number of visits', value: this.hasOwnProperty('spentTimes') ? this.spentTimes.length : defaultNumberOfVisits },
      { label: 'Spent time (HH:MM:SS)', value: DateProcessor.secondsToHHMMSS(this.spentTime) },
      { label: 'Ratings', value: this.userRatings.join(', ') }
    ];
  }
}

export default PerformanceMeasuresTrace;
