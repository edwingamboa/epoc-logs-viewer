/* global FileReader */
import '../styles/main_style.css';
import '../styles/bootstrap.min.css';
import EventsTrace from './events-trace';
import PerformanceMeasuresTrace from './performance-measures-trace';
import 'c3/c3.css';
import * as d3 from 'd3';
import c3 from 'c3';
import * as constants from './constants';
import { UIProcessor } from './utils';

(function () {
  var filesInput = document.querySelector('#' + constants.LOGS_FILE_INPUT_ID);
  var performanceMeasuresData;
  var eventsTracesData;
  var currentPm = 'SCA_ENG';
  var segmentsChartsData;
  const ENGAGED_INDEX = 0;
  const DISENGAGED_INDEX = 1;
  const ENGAGED_X_INDEX = 2;
  const DISENGAGED_X_INDEX = 3;
  const TRACE_TYPES = { pm: 'Pm', trace: 'Trace' };

  function createMetaDataMapForSegmentsOfInterest () {
    segmentsChartsData = new Map();
    constants.segmentsOfInterest.forEach(function (segmentName) {
      let barChartId = segmentName + 'distributionChart';
      let scatterChartId = segmentName + 'meanEngChart';

      createContainersForSegmentCharts(segmentName, barChartId, scatterChartId);

      let barChartData = generateInitialBarChartData();
      let scatterColumns = generateInitialScatterData();
      segmentsChartsData.set(segmentName, generateSegmentChartsData(barChartData, barChartId, scatterColumns, scatterChartId));
    });
  }

  function createContainersForSegmentCharts (segmentName, barChartId, scatterChartId) {
    createContainerForSegmentChart(segmentName, barChartId, 'Participants distribution');
    createContainerForSegmentChart(segmentName, scatterChartId, 'Participants\' mean ' + currentPm);
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
      )
    };
    return segmentChartsData;
  }

  function generateInitialScatterData () {
    let scatterColumns = [];
    scatterColumns[ENGAGED_INDEX] = [ 'engaged' ];
    scatterColumns[DISENGAGED_INDEX] = [ 'disengaged' ];
    scatterColumns[ENGAGED_X_INDEX] = [ 'engaged_x' ];
    scatterColumns[DISENGAGED_X_INDEX] = [ 'disengaged_x' ];
    return scatterColumns;
  }

  function generateInitialBarChartData () {
    let barChartData = [];
    barChartData[ENGAGED_INDEX] = { name: 'engaged', percentage: 0, count: 0 };
    barChartData[DISENGAGED_INDEX] = { name: 'disengaged', percentage: 0, count: 0 };
    return barChartData;
  }

  function createContainerForSegmentChart (segmentName, divId, title) {
    let segmentChartsDiv = d3.select('#' + segmentName);
    if (segmentChartsDiv.empty()) {
      let mainContainer = d3.select('#' + constants.MAIN_CONTENT_DIV_ID);
      mainContainer.append('h4')
        .text(segmentName);
      segmentChartsDiv = mainContainer.append('div');
      segmentChartsDiv.attr('id', segmentName)
        .attr('class', 'row');
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
      legend: {
        show: false
      }
    };
  }

  function generateChartObjectForScatter (segmentData, divId) {
    return {
      data: {
        columns: segmentData,
        type: 'scatter',
        xs: {
          engaged: 'engaged_x',
          disengaged: 'disengaged_x'
        }
      },
      axis: {
        x: {
          type: 'category'
        },
        y: {
          label: {
            text: 'Mean ' + currentPm,
            position: 'outer-middle'
          },
          max: 1,
          min: -1
        }
      },
      bindto: '#' + divId
    };
  }

  function addUserTraceToData (segmentInfo, userId) {
    let segmentName = segmentInfo.segment.action;
    if (segmentsChartsData.has(segmentName)) {
      let segmentData = segmentsChartsData.get(segmentName);
      segmentData.totalUsers += 1;
      updateBarChartsData(segmentInfo);
      updateScatterChartsData(segmentInfo);
    }
  }

  function updateBarChartsData (segmentInfo) {
    let segmentName = segmentInfo.segment.action;
    let segmentData = segmentsChartsData.get(segmentName);
    let dataIndex = segmentInfo.isEngaged ? ENGAGED_INDEX : DISENGAGED_INDEX;
    segmentData.distributionData[dataIndex].count += 1;

    segmentData.distributionData[ENGAGED_INDEX].percentage = calculatePercentage(
      segmentData.distributionData[ENGAGED_INDEX].count,
      segmentData.totalUsers
    );
    segmentData.distributionData[DISENGAGED_INDEX].percentage = calculatePercentage(
      segmentData.distributionData[DISENGAGED_INDEX].count,
      segmentData.totalUsers
    );
    segmentsChartsData.set(segmentName, segmentData);
  }

  function updateScatterChartsData (segmentInfo) {
    let segmentName = segmentInfo.segment.action;
    let segmentData = segmentsChartsData.get(segmentName);

    if (segmentInfo.isEngaged) {
      segmentData.scatterData[ENGAGED_INDEX].push(segmentInfo.meanPmValue);
      segmentData.scatterData[ENGAGED_X_INDEX].push('user' + segmentData.totalUsers);
    } else {
      segmentData.scatterData[DISENGAGED_INDEX].push(segmentInfo.meanPmValue);
      segmentData.scatterData[DISENGAGED_X_INDEX].push('user' + segmentData.totalUsers);
    }
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
      updateBarCharts(segmentName);
      updateScatterCharts(segmentName);
    });
  }

  function calculatePercentage (value, total) {
    return (value / total) * 100;
  }

  function addUserTraces (requests) {
    Promise.all(requests)
      .then(function (responses) {
        createMetaDataMapForSegmentsOfInterest();
        performanceMeasuresData = new Map();
        eventsTracesData = new Map();
        responses.forEach(function (response) {
          if (response.fileNameData.typeOfTrace === TRACE_TYPES.pm) {
            performanceMeasuresData.set(response.fileNameData.userId, response.data);
          } else {
            eventsTracesData.set(response.fileNameData.userId, response.data);
          }
        });

        let eventsTrace;
        let performanceMeasuresTrace;
        eventsTracesData.forEach(function (data, userId) {
          eventsTrace = new EventsTrace(data);
          performanceMeasuresTrace = new PerformanceMeasuresTrace(performanceMeasuresData.get(userId), eventsTrace.segments);
          performanceMeasuresTrace.getJointSegmentsInfo(currentPm).forEach(function (segmentInfo) {
            addUserTraceToData(segmentInfo, userId);
          });
        });
        updateAllCharts();
        resetFileChoosers();
        UIProcessor.switchToMainContent();
      })
      .catch(function (error) {
        console.error(error);
      });
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
    handleFilesLoading(e.target.files);
    disableFileChoosers();
    UIProcessor.switchToProgressSpinner();
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
    addUserTraces(requests);
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
    performanceMeasuresData = [];
  }
}());
