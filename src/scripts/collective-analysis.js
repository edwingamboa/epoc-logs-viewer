/* global FileReader */
import '../styles/main_style.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { EventsTrace } from './events-trace';
import PerformanceMeasuresTrace from './performance-measures-trace';
import 'c3/c3.css';
import * as d3 from 'd3';
import c3 from 'c3';
import * as constants from './constants';
import * as ss from 'simple-statistics';
import { UIProcessor, NumberProcessor, DateProcessor, PmProcessor } from './utils';

(function () {
  var filesInput = document.querySelector('#' + constants.LOGS_FILE_INPUT_ID);
  var performanceMeasuresData;
  var eventsTracesData;
  var currentPm = constants.DEFAULT_PM_ID;
  var segmentsChartsData;
  var segmentDistance = constants.DEFAULT_SEGMENT_DISTANCE;
  const POSITIVE_RESULT_INDEX = 0;
  const NEGATIVE_RESULT_INDEX = 1;
  const TRACE_TYPES = { pm: 'Pm', trace: 'Trace' };
  const COLOR_CODES = ['#3574B2', '#F77F21'];
  const CHARTS_DIV_ID = 'chartsContainer';
  const TOTAL_USERS_TEXT_ID = 'totalUsersText';
  const CHART_DETAILS_CONTAINER_ID = 'detailsContainer';
  const CHART_HEIGHT = 200;
  const numberOfDecimalsForPercentages = 2;
  const SET_UP_SUBMIT_EVENT_ID = 'setUpSubmitBtn';
  const SUFFIX_TITLE_ID = 'suffixTitle';
  const CHARTS_SPINNER_ID = 'chartsProgressSpinner';
  const TRENDS_LABELS = {
    positive: 'Positive Trend',
    negative: 'Negative Trend'
  }
  const DISTRIBUTION_CHART_RANGE = { y: { max: 100 } };
  const CHANGE_VALUE_CHART_RANGE = { y: { min: -0.5, max: 0.5 } };

  addSetUpUIElements();

  function addSetUpUIElements () {
    addElapTimeInputForSegments();
    updateCurrentPmInResultsTitle();
    document.querySelector('#' + SET_UP_SUBMIT_EVENT_ID).addEventListener('click', function () {
      UIProcessor.displayProgressSpinner(CHARTS_SPINNER_ID);
      updateCurrentPmInResultsTitle();
      setTimeout(updateUserTraces, 500);
    });
    addCurrentPmSelector();
  }

  function addCurrentPmSelector () {
    let currentPmSelector = UIProcessor.createRadioBtsToSelectPm(function (newValue) {
      currentPm = newValue;
    });
    document.querySelector('#' + constants.CURRENT_PM_SELECTION_DIV_ID).appendChild(currentPmSelector);
  }

  function addElapTimeInputForSegments () {
    var elapTimeInputForTrendChart = UIProcessor.createElapTimeInputForSegments(function (newValue) {
      segmentDistance = parseInt(newValue);
    });
    document.querySelector('#' + constants.TOLERANCE_TIME_DIV_ID + 'Div').appendChild(elapTimeInputForTrendChart);
  }

  function initMetaDataMapForSegmentsOfInterest () {
    segmentsChartsData = new Map();
    constants.segmentsOfInterest.forEach(function (segmentName) {
      let barChartId = segmentName + 'distributionChart';
      let meanChangeChartId = segmentName + 'meanChangeChartId';
      let scatterChartId = segmentName + 'meanEngChart';

      createContainersForSegmentCharts(segmentName, barChartId, meanChangeChartId, scatterChartId);

      let barChartData = generateInitialBarChartData();
      let meanChangeChartData = generateInitialRelativeChangeChartData();
      let scatterColumns = [];
      segmentsChartsData.set(
        segmentName,
        generateSegmentChartsData(barChartData, barChartId, meanChangeChartData, meanChangeChartId, scatterColumns, scatterChartId)
      );
    });
  }

  function createContainersForSegmentCharts (segmentName, barChartId, meanChangeChartId, scatterChartId) {
    const barChartTitle = 'Participants distribution';
    const meanChangeChartTitle = 'Mean relative change';
    const scatterTitle = `Participants' mean ${PmProcessor.generateVerboseOfPm(currentPm)}`;

    appendContainerForSegmentChart(segmentName, barChartId, barChartTitle);
    appendContainerForSegmentChart(segmentName, meanChangeChartId, meanChangeChartTitle);
    appendContainerForSegmentChart(segmentName, scatterChartId, scatterTitle);
  }

  function generateSegmentChartsData (barChartData, barChartId, meanChangeChartData, meanChangeChartId, scatterColumns, scatterChartId) {
    let segmentChartsData = {
      distributionData: barChartData,
      distributionChart: createChartForSegmentOfInterest(
        generateChartObjectForBarChart(barChartData, barChartId)
      ),
      totalUsers: 0,
      scatterData: scatterColumns,
      scatterChart: createChartForSegmentOfInterest(
        generateChartObjectForScatter(scatterColumns, scatterChartId)
      ),
      meanChangeData: meanChangeChartData,
      meanChangeChart: createChartForSegmentOfInterest(
        generateChartObjectForChangeValueChart(
          meanChangeChartData,
          meanChangeChartId
        )
      ),
      userIds: [],
      spentTimes: [],
      pmValues: [],
      excludedDueToConstantPmUserIds: []
    };
    return segmentChartsData;
  }

  function generateInitialBarChartData () {
    let barChartData = [];
    barChartData[POSITIVE_RESULT_INDEX] = { name: TRENDS_LABELS.positive, value: 0, count: 0 };
    barChartData[NEGATIVE_RESULT_INDEX] = { name: TRENDS_LABELS.negative, value: 0, count: 0 };
    return barChartData;
  }

  function generateInitialRelativeChangeChartData () {
    let barChartData = [];
    barChartData[POSITIVE_RESULT_INDEX] = { name: TRENDS_LABELS.positive, value: 0, changeValues: [], sd: 0 };
    barChartData[NEGATIVE_RESULT_INDEX] = { name: TRENDS_LABELS.negative, value: 0, changeValues: [], sd: 0 };
    return barChartData;
  }

  function appendContainerForSegmentChart (segmentName, divId, title) {
    let segmentChartsDiv = d3.select('#' + segmentName);
    if (segmentChartsDiv.empty()) {
      let mainContainer = d3.select('#' + CHARTS_DIV_ID);
      segmentChartsDiv = mainContainer.append('div');
      segmentChartsDiv.attr('id', segmentName)
        .attr('class', 'row');
      segmentChartsDiv.append('h4')
        .text(segmentName)
        .attr('class', 'col-sm-12');
      segmentChartsDiv.append('div')
        .attr('id', CHART_DETAILS_CONTAINER_ID)
        .attr('class', 'col-sm-12');
    }
    let chartContainer = segmentChartsDiv.append('div')
      .attr('class', 'col-sm-4');
    chartContainer.append('h5')
      .text(title);
    chartContainer.append('div')
      .attr('id', divId);
  }

  function createChartForSegmentOfInterest (config) {
    return c3.generate(config);
  }

  function generateChartObjectForBarChart (segmentData, divId) {
    let chartObject = generateChartObjectForSegment(segmentData, divId, 'Participants (%)');
    chartObject.axis.y.max = DISTRIBUTION_CHART_RANGE.y.max;
    chartObject.data.labels = { format: function (v) { return v + '%'; } };
    return chartObject;
  }

  function generateChartObjectForChangeValueChart (segmentData, divId) {
    let chartObject = generateChartObjectForSegment(segmentData, divId, 'Relative change');
    chartObject.axis.y.max = CHANGE_VALUE_CHART_RANGE.y.max;
    chartObject.axis.y.min = CHANGE_VALUE_CHART_RANGE.y.min;
    chartObject.data.labels = {
      format: function (v, id, i) {
        if (i !== undefined) {
          return `${v} ±${segmentData[i].sd}`;
        }
      }
    };
    chartObject.grid = { y: { lines: [ { value: 0 } ] } };
    return chartObject;
  }

  function generateChartObjectForSegment (segmentData, divId, yLabel) {
    let dataObject = {
      data: {
        json: segmentData,
        keys: {
          x: 'name',
          value: [ 'value' ]
        },
        type: 'bar',
        color: function (color, d) {
          return COLOR_CODES[d.index];
        }
      },
      axis: {
        x: {
          type: 'category'
        },
        y: {
          label: {
            text: yLabel,
            position: 'outer-middle'
          }
        }
      },
      bindto: '#' + divId,
      size: {
        height: CHART_HEIGHT
      },
      legend: {
        show: false
      }
    };
    return dataObject;
  }

  function generateChartObjectForScatter (segmentData, divId) {    
    let chartProperties =  {
      data: {
        json: segmentData,
        type: 'scatter',
        keys: {
          x: 'userId',
          value: [TRENDS_LABELS.positive, TRENDS_LABELS.negative]
        },
        xSort: false
      },
      axis: {
        x: {
          type: 'category',
          tick: {
            rotate: 90,
            multiline: false
          }
        },
        y: {
          label: {
            text: 'Mean ' + currentPm,
            position: 'outer-middle'
          }
        }
      },
      bindto: '#' + divId,
      size: {
        height: CHART_HEIGHT
      },
      tooltip: {
        contents: function (d) {
          return generateUserTooltipInfoHTMLCode(segmentData[d[0].index]);
        }
      }
    };
    if (segmentData.length > 0) {
      chartProperties.grid = {
        y: {
          lines: generateYRegionLinesForScatter(segmentData)
        }
      }
    }
    return chartProperties;
  }

  function generateYRegionLinesForScatter (data) {
    let desiredPmAdjective = TRENDS_LABELS.positive;
    let notDesiredPmAdjective = TRENDS_LABELS.negative;
    let values = [];
    let value;
    data.forEach(function (point) {
      value = point.hasOwnProperty(desiredPmAdjective) ? point[desiredPmAdjective] : point[notDesiredPmAdjective];
      values.push(value);
    });
    let max = ss.max(values);
    let min = ss.min(values);
    let step = (max - min) / 4;
    let lineRegionsLabels = [ '++', '+', '', '-', '--' ];
    let regionsLines = [];
    let regionLine;
    const numberOfDecimals = 2;
    for (let i = 0; i < lineRegionsLabels.length; i++) {
      regionLine = {
        value: max - (step * i)
      };
      if (lineRegionsLabels[i] !== '') {
        regionLine.text = lineRegionsLabels[i];
      } else {
        regionLine.text = NumberProcessor.round(regionLine.value, numberOfDecimals);
      }
      regionsLines.push(regionLine);
    }
    return regionsLines;
  }

  function generateUserTooltipInfoHTMLCode (userData) {
    let tooltipDiv = d3.select(document.createElement('div'));
    let tooltipTableBody = tooltipDiv
      .attr('class', 'c3-tooltip-container')
      .append('table')
      .attr('class', 'c3-tooltip')
      .append('tbody');
    tooltipTableBody
      .append('tr')
      .append('th')
      .attr('colspan', 2)
      .text(userData.userId);

    let rowData = [
      {
        squareColor: userData.segmentInfo.isDesired() ? COLOR_CODES[POSITIVE_RESULT_INDEX] : COLOR_CODES[NEGATIVE_RESULT_INDEX],
        value: userData.segmentInfo.isDesired() ? TRENDS_LABELS.positive : TRENDS_LABELS.negative
      }
    ];

    rowData = rowData.concat(userData.segmentInfo.details);

    let rowContent;
    let rowLabel;
    rowData.forEach(function (row) {
      rowContent = tooltipTableBody
        .append('tr');
      rowLabel = rowContent
        .append('td');
      if (row.hasOwnProperty('squareColor')) {
        rowLabel
          .append('span')
          .style('background-color', row.squareColor);
      }
      if (row.hasOwnProperty('label')) {
        rowLabel
          .append('text')
          .text(row.label);
        rowContent
          .append('td')
          .text(row.value);
      } else {
        rowLabel.attr('colspan', 2);
        rowLabel
          .append('text')
          .text(row.value);
      }
    });
    return tooltipDiv.html();
  }

  function addUserTraceToData (segmentInfo, userId) {
    let segmentName = segmentInfo.segment.action;
    if (segmentsChartsData.has(segmentName)) {
      let segmentData = segmentsChartsData.get(segmentName);
      segmentData.totalUsers += 1;
      segmentData.userIds.push(userId);
      segmentData.spentTimes.push(segmentInfo.spentTime);
      segmentData.pmValues = segmentData.pmValues.concat(segmentInfo.pmValues);
      updateBarChartsData(segmentInfo);
      updateChangeValueChartsData(segmentInfo);
      updateScatterChartsData(segmentInfo, userId);
    }
  }

  function addExcludedToConstantPmUser (segmentInfo, userId) {
    let segmentName = segmentInfo.segment.action;
    if (segmentsChartsData.has(segmentName)) {
      segmentsChartsData.get(segmentName).excludedDueToConstantPmUserIds.push(userId);
    }
  }

  function updateChangeValueChartsData (segmentInfo) {
    let segmentName = segmentInfo.segmentName;
    let segmentData = segmentsChartsData.get(segmentName);
    let dataIndex = segmentInfo.isDesired() ? POSITIVE_RESULT_INDEX : NEGATIVE_RESULT_INDEX;
    let changeValues = segmentData.meanChangeData[dataIndex].changeValues.concat(segmentInfo.changeValues);

    segmentData.meanChangeData[dataIndex].changeValues = changeValues;
    segmentsChartsData.set(segmentName, segmentData);
  }

  function calculateFinalValuesOfChangeValueCharts (segmentName) {
    let segmentData = segmentsChartsData.get(segmentName);
    let mean;
    let sd;
    const numberOfDecimals = 3;
    let indexes = [ POSITIVE_RESULT_INDEX, NEGATIVE_RESULT_INDEX];
    indexes.forEach(function (index) {
      if (segmentData.meanChangeData[index].changeValues.length > 0) {
        mean = ss.mean(segmentData.meanChangeData[index].changeValues);
        sd = ss.sampleStandardDeviation(segmentData.meanChangeData[index].changeValues);
        segmentData.meanChangeData[index].value = NumberProcessor.round(mean, numberOfDecimals);
        segmentData.meanChangeData[index].sd = NumberProcessor.round(sd, numberOfDecimals);
      }
    });
    segmentsChartsData.set(segmentName, segmentData);
  }

  function updateBarChartsData (segmentInfo) {
    let segmentName = segmentInfo.segmentName;
    let segmentData = segmentsChartsData.get(segmentName);
    let dataIndex = segmentInfo.isDesired() ? POSITIVE_RESULT_INDEX : NEGATIVE_RESULT_INDEX;
    segmentData.distributionData[dataIndex].count += 1;
    segmentsChartsData.set(segmentName, segmentData);
  }

  function calculateFinalValuesOfBarCharts (segmentName) {
    let segmentData = segmentsChartsData.get(segmentName);
    segmentData.distributionData[POSITIVE_RESULT_INDEX].value = NumberProcessor.calculateRoundedPercentage(
      segmentData.distributionData[POSITIVE_RESULT_INDEX].count,
      segmentData.totalUsers,
      numberOfDecimalsForPercentages
    );
    segmentData.distributionData[NEGATIVE_RESULT_INDEX].value = NumberProcessor.calculateRoundedPercentage(
      segmentData.distributionData[NEGATIVE_RESULT_INDEX].count,
      segmentData.totalUsers,
      numberOfDecimalsForPercentages
    );
    segmentsChartsData.set(segmentName, segmentData);
  }

  function updateScatterChartsData (segmentInfo, userId) {
    let segmentName = segmentInfo.segment.action;
    let segmentData = segmentsChartsData.get(segmentName);
    let userData = {};
    userData.userId = userId;
    userData.segmentInfo = segmentInfo;
    if (segmentInfo.isDesired()) {
      userData[TRENDS_LABELS.positive] = segmentInfo.meanPmValue;
    } else {
      userData[TRENDS_LABELS.negative] = segmentInfo.meanPmValue;
    }
    segmentData.scatterData.push(userData);
    segmentsChartsData.set(segmentName, segmentData);
  }

  function updateBarCharts (segmentName) {
    calculateFinalValuesOfBarCharts(segmentName);
    let segmentChartData = segmentsChartsData.get(segmentName);
    let loadData = generateChartObjectForBarChart(segmentChartData.distributionData).data;
    segmentChartData.distributionChart.load(loadData);
  }

  function updateChangeValueCharts (segmentName) {
    calculateFinalValuesOfChangeValueCharts(segmentName);
    let segmentChartData = segmentsChartsData.get(segmentName);
    let loadData = generateChartObjectForChangeValueChart(segmentChartData.meanChangeData).data;
    segmentChartData.meanChangeChart.load(loadData);
  }

  function updateScatterCharts (segmentName) {
    let scatterChartData = segmentsChartsData.get(segmentName);
    let loadData = generateChartObjectForScatter(scatterChartData.scatterData).data;
    scatterChartData.scatterChart.load(loadData);
    scatterChartData.scatterChart.ygrids(generateYRegionLinesForScatter(scatterChartData.scatterData));
  }

  function updateAllCharts () {
    constants.segmentsOfInterest.forEach(function (segmentName) {
      updateSegmentDetails(segmentName);
      updateBarCharts(segmentName);
      updateChangeValueCharts(segmentName);
      updateScatterCharts(segmentName);
    });
  }

  function updateSegmentDetails (segmentName) {
    function detailsOfAListOfUsers (listOfUsers) {
      return `${detailsOfPercentageOfUsers(listOfUsers.length)} => ${listOfUsers.join(', ')}`;
    }

    function detailsOfPercentageOfUsers (numberOfUsers) {
      let percentageOfUsers = NumberProcessor.calculateRoundedPercentage(
        numberOfUsers,
        getTotalNumberOfUsers(),
        numberOfDecimalsForPercentages
      );
      return `${numberOfUsers} (${percentageOfUsers}%)`;
    }

    let segmentData = segmentsChartsData.get(segmentName);
    let detailsContainer = d3.select('#' + segmentName + ' #' + CHART_DETAILS_CONTAINER_ID);
    let details = [
      { label: 'Number of users: ', value: detailsOfPercentageOfUsers(segmentData.totalUsers) }
    ];

    let missingUsers = missingUsersOfSegment(segmentName);
    if (missingUsers.length > 0) {
      details.push({
        label: 'Participants who skipped the segment: ',
        value: detailsOfAListOfUsers(missingUsers)
      });
    }
    if (segmentData.excludedDueToConstantPmUserIds.length > 0) {
      details.push({
        label: 'Participants excluded due to constant measure: ',
        value: detailsOfAListOfUsers(segmentData.excludedDueToConstantPmUserIds)
      });
    }
    let meanSpentTime = Math.floor(ss.mean(segmentData.spentTimes));
    let sdSpentTime = ss.sampleStandardDeviation(segmentData.spentTimes);
    let numberOfDecimals = 2;
    if (segmentData.spentTimes.length > 0) {
      details.push({
        label: 'Mean participants\' spent time (HH:MM:SS): ',
        value: `${DateProcessor.secondsToHHMMSS(meanSpentTime)} ` +
        `(${NumberProcessor.round(meanSpentTime, numberOfDecimals)} s ±${NumberProcessor.round(sdSpentTime, numberOfDecimals)})`
      });
    }
    let meanPmValue = ss.mean(segmentData.pmValues);
    let sdPmValue = ss.sampleStandardDeviation(segmentData.pmValues);
    numberOfDecimals = 5;
    if (segmentData.pmValues.length > 0) {
      details.push({
        label: `Mean participants\' ${currentPm}: `,
        value: `${NumberProcessor.round(meanPmValue, numberOfDecimals)} ±${NumberProcessor.round(sdPmValue, numberOfDecimals)}`
      });
    }
    let detailContainer;
    details.forEach(function (detail) {
      detailContainer = detailsContainer.append('div');
      detailContainer.append('span')
        .text(detail.label)
        .attr('class', 'font-weight-bold');
      detailContainer.append('span')
        .text(detail.value);
    });
  }

  function missingUsersOfSegment (segmentName) {
    let segmentData = segmentsChartsData.get(segmentName);
    let missingUsers = [];
    for (let userId of performanceMeasuresData.keys()) {
      if (segmentData.userIds.indexOf(userId) < 0 && 
      segmentData.excludedDueToConstantPmUserIds.indexOf(userId) < 0) {
        missingUsers.push(userId);
      }
    }
    return missingUsers;
  }

  function run (requests) {
    Promise.all(requests)
      .then(function (responses) {
        performanceMeasuresData = new Map();
        eventsTracesData = new Map();
        responses.forEach(function (response) {
          if (response.fileNameData.typeOfTrace === TRACE_TYPES.pm) {
            performanceMeasuresData.set(response.fileNameData.userId, response.data);
          } else {
            eventsTracesData.set(response.fileNameData.userId, response.data);
          }
        });
        updateUserTraces(true);
        resetFileChoosers();
        updateNumberOfUsersText(getTotalNumberOfUsers());
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function getTotalNumberOfUsers () {
    return eventsTracesData.size;
  }

  function updateNumberOfUsersText (totalUsers) {
    d3.select('#' + TOTAL_USERS_TEXT_ID).text(totalUsers);
  }

  function updateCurrentPmInResultsTitle () {
    d3.select('#' + SUFFIX_TITLE_ID).text(PmProcessor.generateVerboseOfPm(currentPm));
  }

  function updateUserTraces (isReset) {
    cleanChartsContainer();
    initMetaDataMapForSegmentsOfInterest();
    let eventsTrace;
    let performanceMeasuresTrace;
    eventsTracesData.forEach(function (data, userId) {
      eventsTrace = new EventsTrace(data, segmentDistance);
      performanceMeasuresTrace = new PerformanceMeasuresTrace(performanceMeasuresData.get(userId), eventsTrace.segments);
      performanceMeasuresTrace.getJointSegmentsInfo(currentPm).forEach(function (segmentInfo) {
        if (segmentInfo.pmIsConstant()) {
          addExcludedToConstantPmUser(segmentInfo, userId);
        } else {
          addUserTraceToData(segmentInfo, userId);
        }
      });
    });
    updateAllCharts();
    let spinnerToHide = isReset ? constants.MAIN_PROGRESS_SPINNER_ID : CHARTS_SPINNER_ID;
    UIProcessor.hideProgressSpinner(spinnerToHide);
  }

  function extractDataOfFileName (fileName) {
    let data = {};
    data.fileId = fileName.substring(0, fileName.indexOf('.csv'));
    let fileData = data.fileId.split('_');
    data.typeOfTrace = fileData[0];
    data.userId = fileData[1];
    return data;
  }

  filesInput.addEventListener('change', function (e) {
    UIProcessor.displayProgressSpinner();
    UIProcessor.displayMainContent();
    handleFilesLoading(e.target.files);
    disableFileChoosers();
  });

  function handleFilesLoading (files) {
    let requests = [];
    let file;
    let request;
    for (let i = 0; i < files.length; i++) {
      file = files.item(i);
      request = readSingleFile(file);
      requests.push(request);
    };
    run(requests);
  }

  function readSingleFile (file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Invalid file url'));
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        resolve({
          data: e.target.result,
          fileNameData: extractDataOfFileName(file.name)
        });
      };
      reader.readAsText(file);
    });
  }

  function disableFileChoosers () {
    filesInput.setAttribute('disabled', true);
  }

  function resetFileChoosers () {
    filesInput.removeAttribute('disabled');
    filesInput.value = '';
  }

  function cleanChartsContainer () {
    d3.select('#' + CHARTS_DIV_ID).html('');
  }
}());
