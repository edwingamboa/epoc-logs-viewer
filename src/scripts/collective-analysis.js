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
  var segmentsChartsData = new Map();
  const ENGAGED_INDEX = 0;
  const DISENGAGED_INDEX = 1;


  function createDataArrayForSegmentsOfInterest () {
    constants.segmentsOfInterest.forEach(function (segmentName) {
      createContainerForSegmentChart(segmentName)
      let segmentData = [];
      segmentData[ENGAGED_INDEX] = { name: 'engaged', percentage: 0, count: 0};
      segmentData[DISENGAGED_INDEX] = { name: 'disengaged', percentage: 0, count: 0};

      segmentsChartsData.set(segmentName, { 
        data: segmentData,
        chart: createChartsForSegmentOfInterest(segmentData, segmentName),
        totalUsers: 0
      })
    });
  }

  function createContainerForSegmentChart (segmentName) {
    d3.select('#' + constants.MAIN_CONTENT_DIV_ID)
    .append('div')
    .append('h4')
    .text('Participants distribution for ' + segmentName)
    .append('div')
    .attr('id', segmentName)
  }

  function createChartsForSegmentOfInterest (segmentData, segmentName) {
    return c3.generate({
      data: generateChartDataObjectForSegment(segmentData),
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
      bindto: '#' + segmentName,
      legend: {
          show: false
      }
    })
  }

  function generateChartDataObjectForSegment (segmentData) {
    return { 
      json: segmentData,
      keys: {
        x: 'name',
        value: [ 'percentage' ]
      },
      type: 'bar',
      labels: {
        format: function (v) { return v + '%' }
      }
    }
  }

  function addUserTraceToData (segmentName, isEngaged) {
    if (segmentsChartsData.has(segmentName)) {
      let segmentData = segmentsChartsData.get(segmentName);
      segmentData.totalUsers += 1;

      let dataIndex = isEngaged ? ENGAGED_INDEX : DISENGAGED_INDEX;
      segmentData.data[dataIndex].count += 1;

      segmentData.data[ENGAGED_INDEX].percentage = calculatePercentage(segmentData.data[ENGAGED_INDEX].count, segmentData.totalUsers);
      segmentData.data[DISENGAGED_INDEX].percentage = calculatePercentage(segmentData.data[DISENGAGED_INDEX].count, segmentData.totalUsers);

      segmentsChartsData.set(segmentName, segmentData);

      updateSegmentChart (segmentName);
    }
  }

  function updateSegmentChart (segmentName) {
    let segmentChartData = segmentsChartsData.get(segmentName);
    let loadData = generateChartDataObjectForSegment(segmentChartData.data);
    segmentChartData.chart.load(loadData);
    console.log(segmentName, segmentChartData.data);
  }

  function calculatePercentage (value, total) {
    return (value / total) * 100;
  }

  function addUserTraces (requests) {
    Promise.all(requests)
      .then(function (responses) {
        if (firstRun) {
          createDataArrayForSegmentsOfInterest();
          firstRun = false;
        }
        let eventsTrace = new EventsTrace(responses[1].data);
        let performanceMeasuresTrace = new PerformanceMeasuresTrace(responses[0].data, eventsTrace.segments);
        performanceMeasuresTrace.segmentsInfo.forEach(function (segmentInfo) {
          addUserTraceToData(segmentInfo.segment.action, segmentInfo.isEngaged);
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
    updateLoadedFilesText('');
  }

  function resetFileChoosers () {
    pmFileInput.removeAttribute('disabled');
    userTraceFileInput.removeAttribute('disabled');
    addTracesBtn.removeAttribute('disabled');
    pmFileInput.value = '';
    userTraceFileInput.value = '';
    pmCsvRequest = undefined;
    userTraceCsvRequest = undefined;
    updateLoadedFilesText('');
  }

  function updateLoadedFilesText (text) {
    loadedFilesTextElement.innerHTML = text;
  }

  function appendTextToFilesText (text) {
    loadedFilesTextElement.innerHTML += text;
  }
}());
