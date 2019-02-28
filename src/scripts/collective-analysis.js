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
  var pmFileInput = document.querySelector('#' + constants.PM_FILE_INPUT_ID);
  var userTraceFileInput = document.querySelector('#' + constants.UT_FILE_INPUT_ID);
  var loadedFilesTextElement = document.querySelector('#' + constants.LOADED_FILES_TEXT_ID);
  var addTracesBtn = document.querySelector('#' + constants.ADD_FILE_BUTTON_ID);
  var firstRun = true;
  var pmCsvRequest;
  var userTraceCsvRequest;
  var currentPm = 'SCA_ENG';
  var segmentsChartsData = new Map();
  const ENGAGED_INDEX = 0;
  const DISENGAGED_INDEX = 1;
  const ENGAGED_X_INDEX = 2;
  const DISENGAGED_X_INDEX = 3;
  var usersCounter = 0;


  function createMetaDataMapForSegmentsOfInterest () {
    constants.segmentsOfInterest.forEach(function (segmentName) {
      let barChartId = segmentName + 'distributionChart';
      let scatterChartId = segmentName + 'meanEngChart';
      
      createContainersForSegmentCharts(segmentName, barChartId, scatterChartId);
      
      let barChartData = generateInitialBarChartData();
      let scatterColumns = generateInitialScatterData();
      segmentsChartsData.set(segmentName, generateSegmentChartsData(barChartData, barChartId, scatterColumns, scatterChartId));
    });
  }

  function createContainersForSegmentCharts(segmentName, barChartId, scatterChartId) {
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
      ),
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
    barChartData[ENGAGED_INDEX] = { name: 'engaged', percentage: 0, count: 0};
    barChartData[DISENGAGED_INDEX] = { name: 'disengaged', percentage: 0, count: 0};
    return barChartData;
  } 

  function createContainerForSegmentChart (segmentName, divId, title) {
    let segmentChartsDiv = d3.select('#' + segmentName)
    if (segmentChartsDiv.empty()) {
      let mainContainer = d3.select('#' + constants.MAIN_CONTENT_DIV_ID)
      mainContainer.append('h4')
        .text(segmentName)
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
    return c3.generate(config)
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
          format: function (v) { return v + '%' }
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
    }    
  }

  function generateChartObjectForScatter (segmentData, divId) {
    return {
      data: { 
        columns: segmentData,
        type: 'scatter',
        xs: {
          engaged: 'engaged_x',
          disengaged: 'disengaged_x',
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
      bindto: '#' + divId,
    }
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
    updateBarCharts(segmentName);
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
    updateScatterCharts(segmentName);
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

  function calculatePercentage (value, total) {
    return (value / total) * 100;
  }

  function addUserTraces (requests) {
    Promise.all(requests)
      .then(function (responses) {
        if (firstRun) {
          createMetaDataMapForSegmentsOfInterest();
          firstRun = false;
        }
        let eventsTrace = new EventsTrace(responses[1].data);
        let performanceMeasuresTrace = new PerformanceMeasuresTrace(responses[0].data, eventsTrace.segments);
        usersCounter++;
        let userId = 'user' + usersCounter;
        console.log(performanceMeasuresTrace.getJointSegmentsInfo(currentPm));
        performanceMeasuresTrace.getJointSegmentsInfo(currentPm).forEach(function (segmentInfo) {
          addUserTraceToData(segmentInfo, userId);
        });
        resetFileChoosers();
        appendTextToFilesText(responses[0].filename + ', ' + responses[1].filename + '; ');
        UIProcessor.switchToMainContent();
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  pmFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'pm');
  });

  userTraceFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'ut');
  });

  addTracesBtn.addEventListener('click', function(e) {
    if (pmCsvRequest && userTraceCsvRequest) {
      disableFileChoosers();
      addUserTraces([pmCsvRequest, userTraceCsvRequest]);
      UIProcessor.switchToProgressSpinner();
    }
  });

  function handleFileLoading (file, id) {
    if (id === 'pm') {
      pmCsvRequest = readSingleFile(file);
    } else {
      userTraceCsvRequest = readSingleFile(file);
    }
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
          filename: file.name
        });
      };
      reader.readAsText(file);
    });
  }

  function disableFileChoosers () {
    pmFileInput.setAttribute('disabled', true);
    userTraceFileInput.setAttribute('disabled', true);
    addTracesBtn.setAttribute('disabled', true);
  }

  function resetFileChoosers () {
    pmFileInput.removeAttribute('disabled');
    userTraceFileInput.removeAttribute('disabled');
    addTracesBtn.removeAttribute('disabled');
    pmFileInput.value = '';
    userTraceFileInput.value = '';
    pmCsvRequest = undefined;
    userTraceCsvRequest = undefined;
  }

  function updateLoadedFilesText (text) {
    loadedFilesTextElement.innerHTML = text;
  }

  function appendTextToFilesText (text) {
    loadedFilesTextElement.innerHTML += text;
  }
}());
