/* global FileReader */
import '../styles/main_style.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import EventsTrace from './events-trace';
import PerformanceMeasuresTrace from './performance-measures-trace';
import 'c3/c3.css';
import * as d3 from 'd3';
import c3 from 'c3';
import * as constants from './constants';
import * as ss from 'simple-statistics';
import { UIProcessor, NumberProcessor, DateProcessor } from './utils';

(function () {
  var filesInput = document.querySelector('#' + constants.LOGS_FILE_INPUT_ID);
  var performanceMeasuresData;
  var eventsTracesData;
  var currentPm = 'SCA_ENG';
  var segmentsChartsData;
  var segmentDistance = constants.DEFAULT_SEGMENT_DISTANCE;
  const ENGAGED_INDEX = 0;
  const DISENGAGED_INDEX = 1;
  const TRACE_TYPES = { pm: 'Pm', trace: 'Trace' };
  const COLOR_CODES = ['#3574B2', '#F77F21'];
  const CHARTS_DIV_ID = 'chartsContainer';
  const TOTAL_USERS_TEXT_ID = 'totalUsersText';
  const CHART_DETAILS_CONTAINER_ID = 'detailsContainer';
  const CHART_HEIGHT = 200;
  const numberOfDecimalsForPercentages = 2;
  const SET_UP_SUBMIT_EVENT_ID = 'setUpSubmitBtn';

  addSetUpUIElements();

  function addSetUpUIElements () {
    addElapTimeInputForSegments();
    document.querySelector('#' + SET_UP_SUBMIT_EVENT_ID).addEventListener('click', function () {
      UIProcessor.displayProgressSpinner();
      setTimeout(updateSegmentDistanceInCharts, 500);
    });
  }

  function addElapTimeInputForSegments () {
    var elapTimeInputForTrendChart = UIProcessor.createElapTimeInputForSegments(function (newValue) {
      segmentDistance = parseInt(newValue);
    });
    document.querySelector('#' + constants.TOLERANCE_TIME_DIV_ID + 'Div').appendChild(elapTimeInputForTrendChart);
  }

  function updateSegmentDistanceInCharts () {
    updateUserTraces(segmentDistance);
  }

  function initMetaDataMapForSegmentsOfInterest () {
    segmentsChartsData = new Map();
    constants.segmentsOfInterest.forEach(function (segmentName) {
      let barChartId = segmentName + 'distributionChart';
      let scatterChartId = segmentName + 'meanEngChart';

      createContainersForSegmentCharts(segmentName, barChartId, scatterChartId);

      let barChartData = generateInitialBarChartData();
      let scatterColumns = [];
      segmentsChartsData.set(segmentName, generateSegmentChartsData(barChartData, barChartId, scatterColumns, scatterChartId));
    });
  }

  function createContainersForSegmentCharts (segmentName, barChartId, scatterChartId) {
    appendContainerForSegmentChart(segmentName, barChartId, 'Participants distribution');
    appendContainerForSegmentChart(segmentName, scatterChartId, 'Participants\' mean ' + currentPm);
  }

  function generateSegmentChartsData (barChartData, barChartId, scatterColumns, scatterChartId) {
    let segmentChartsData = {
      distributionData: barChartData,
      distributionChart: createChartForSegmentOfInterest(
        generateChartObjectForSegment(barChartData, barChartId)
      ),
      totalUsers: 0,
      scatterData: scatterColumns,
      scatterChart: createChartForSegmentOfInterest(
        generateChartObjectForScatter(scatterColumns, scatterChartId)
      ),
      userIds: [],
      spentTimes: []
    };
    return segmentChartsData;
  }

  function generateInitialBarChartData () {
    let barChartData = [];
    barChartData[ENGAGED_INDEX] = { name: 'engaged', percentage: 0, count: 0 };
    barChartData[DISENGAGED_INDEX] = { name: 'disengaged', percentage: 0, count: 0 };
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
      .attr('class', 'col-sm-6');
    chartContainer.append('h5')
      .text(title);
    chartContainer.append('div')
      .attr('id', divId);
  }

  function createChartForSegmentOfInterest (config) {
    return c3.generate(config);
  }

  function generateChartObjectForSegment (segmentData, divId) {
    return {
      data: {
        json: segmentData,
        keys: {
          x: 'name',
          value: [ 'percentage' ]
        },
        type: 'bar',
        labels: {
          format: function (v) { return v + '%'; }
        },
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
            text: 'Participants (%)',
            position: 'outer-middle'
          },
          max: 100
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
  }

  function generateChartObjectForScatter (segmentData, divId) {
    return {
      data: {
        json: segmentData,
        type: 'scatter',
        keys: {
          x: 'userId',
          value: ['engaged', 'disengaged']
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
          },
          max: 1,
          min: 0
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

    const numberOfDecimals = 5;
    const rowData = [
      {
        squareColor: userData.segmentInfo.isEngaged ? COLOR_CODES[ENGAGED_INDEX] : COLOR_CODES[DISENGAGED_INDEX],
        value: userData.segmentInfo.isEngaged ? 'Engaged' : 'Disengaged'
      },
      { label: 'Mean ' + currentPm, value: NumberProcessor.round(userData.segmentInfo.meanPmValue, numberOfDecimals) },
      { label: 'Max ' + currentPm, value: NumberProcessor.round(userData.segmentInfo.maxPmValue, numberOfDecimals) },
      { label: 'Min ' + currentPm, value: NumberProcessor.round(userData.segmentInfo.minPmValue, numberOfDecimals) },
      { label: 'Spent time (HH:MM:SS)', value: DateProcessor.secondsToHHMMSS(userData.segmentInfo.spentTime) }
    ];

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
      updateBarChartsData(segmentInfo);
      updateScatterChartsData(segmentInfo, userId);
    }
  }

  function updateBarChartsData (segmentInfo) {
    let segmentName = segmentInfo.segment.action;
    let segmentData = segmentsChartsData.get(segmentName);
    let dataIndex = segmentInfo.isEngaged ? ENGAGED_INDEX : DISENGAGED_INDEX;
    segmentData.distributionData[dataIndex].count += 1;

    segmentData.distributionData[ENGAGED_INDEX].percentage = NumberProcessor.calculateRoundedPercentage(
      segmentData.distributionData[ENGAGED_INDEX].count,
      segmentData.totalUsers,
      numberOfDecimalsForPercentages
    );
    segmentData.distributionData[DISENGAGED_INDEX].percentage = NumberProcessor.calculateRoundedPercentage(
      segmentData.distributionData[DISENGAGED_INDEX].count,
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
    if (segmentInfo.isEngaged) {
      userData.engaged = segmentInfo.meanPmValue;
    } else {
      userData.disengaged = segmentInfo.meanPmValue;
    }
    segmentData.scatterData.push(userData);
    segmentsChartsData.set(segmentName, segmentData);
  }

  function updateBarCharts (segmentName) {
    let segmentChartData = segmentsChartsData.get(segmentName);
    let loadData = generateChartObjectForSegment(segmentChartData.distributionData).data;
    segmentChartData.distributionChart.load(loadData);
  }

  function updateScatterCharts (segmentName) {
    let scatterChartData = segmentsChartsData.get(segmentName);
    let loadData = generateChartObjectForScatter(scatterChartData.scatterData).data;
    scatterChartData.scatterChart.load(loadData);
  }

  function updateAllCharts () {
    constants.segmentsOfInterest.forEach(function (segmentName) {
      updateSegmentDetails(segmentName);
      updateBarCharts(segmentName);
      updateScatterCharts(segmentName);
    });
  }

  function updateSegmentDetails (segmentName) {
    let segmentData = segmentsChartsData.get(segmentName);
    let detailsContainer = d3.select('#' + segmentName + ' #' + CHART_DETAILS_CONTAINER_ID);
    let percentageOfUsers = NumberProcessor.calculateRoundedPercentage(
      segmentData.totalUsers,
      getTotalNumberOfUsers(),
      numberOfDecimalsForPercentages
    );
    let details = [
      { label: 'Number of users: ', value: segmentData.totalUsers + ' (' + percentageOfUsers + '%)' }
    ];
    let missingUsers = missingUsersOfSegment(segmentName);
    if (missingUsers.length > 0) {
      details.push({
        label: 'Users who missed the segment: ',
        value: segmentData.totalUsers === 0 ? 'All' : missingUsers.join(', ')
      });
    }
    if (segmentData.spentTimes.length > 0) {
      details.push({
        label: 'Mean users\' spent time (HH:MM:SS): ',
        value: DateProcessor.secondsToHHMMSS((ss.mean(segmentData.spentTimes)))
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
      if (segmentData.userIds.indexOf(userId) < 0) {
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
        updateUserTraces();
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

  function updateUserTraces (segmentDistance) {
    cleanChartsContainer();
    initMetaDataMapForSegmentsOfInterest();
    let eventsTrace;
    let performanceMeasuresTrace;
    eventsTracesData.forEach(function (data, userId) {
      eventsTrace = new EventsTrace(data, segmentDistance);
      performanceMeasuresTrace = new PerformanceMeasuresTrace(performanceMeasuresData.get(userId), eventsTrace.segments);
      performanceMeasuresTrace.getJointSegmentsInfo(currentPm).forEach(function (segmentInfo) {
        addUserTraceToData(segmentInfo, userId);
      });
    });
    updateAllCharts();
    UIProcessor.hideProgressSpinner();
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
