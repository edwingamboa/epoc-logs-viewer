/* global FileReader */

import '../styles/main_style.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'c3/c3.css';
import * as d3 from 'd3';
import c3 from 'c3';
import * as constants from './constants';
import {
  EventsTrace
} from './events-trace';
import PerformanceMeasuresTrace from './performance-measures-trace';
import {
  UIProcessor, DataProcessor
} from './utils';

(function () {
  const TREND_PROGRESS_SPINNER_ID = 'trendProgressSpinner';
  const Y_RANGE_PM_CHART = {
    min: 0,
    max: 1
  };
  const CHART_HEIGHT = 300;
  const SET_UP_SUBMIT_EVENT_ID = 'setUpSubmitBtn';

  var pmFileInput = document.querySelector('#' + constants.PM_FILE_INPUT_ID);
  var userTraceFileInput = document.querySelector('#' + constants.UT_FILE_INPUT_ID);
  var loadedFilesTextElement = document.querySelector('#' + constants.LOADED_FILES_TEXT_ID);
  var pmCsvRequest;
  var userTraceCsvRequest;
  var trendsChart;
  var firstRun = true;
  var eventsTrace;
  var performanceMeasuresTrace;
  var segmentDistance = constants.DEFAULT_SEGMENT_DISTANCE;
  var lastSegmentDistance = constants.DEFAULT_SEGMENT_DISTANCE;
  var currentPm = constants.DEFAULT_PM_ID;

  pmFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'pm');
  });

  userTraceFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'ut');
  });

  document.querySelector('#' + SET_UP_SUBMIT_EVENT_ID).addEventListener('click', function () {
    UIProcessor.displayProgressSpinner(TREND_PROGRESS_SPINNER_ID);
    if (lastSegmentDistance !== segmentDistance) {
      lastSegmentDistance = segmentDistance;
      updateTrendChartSegments(segmentDistance);
    }
    setTimeout(changeCurrentPm, 500);
  });

  function run (requests) {
    Promise.all(requests)
      .then(function (responses) {
        clearSegmentChartsContainer();
        eventsTrace = new EventsTrace(responses[1].data);
        performanceMeasuresTrace = new PerformanceMeasuresTrace(responses[0].data, eventsTrace.segments);
        var eventsOfInterestGridLines = parseUserTraceAsGridLines(eventsTrace.segments);

        addTimeSeriesChartFromRows(
          performanceMeasuresTrace.getData(true),
          constants.EPOC_MEASURES_CONTAINER_ID,
          eventsOfInterestGridLines,
          addDetailsToUserTraceGridLines,
          false,
          Y_RANGE_PM_CHART
        );

        trendsChart = addTimeSeriesChartFromJSON(
          performanceMeasuresTrace.getChangeValueData(currentPm),
          constants.TRENDS_VIEWER_CONTAINER_ID,
          generateKeysForSegmentsChangeValue(),
          false,
          eventsOfInterestGridLines,
          addDetailsToUserTraceGridLines,
          true
        );
        addTrendLinesToTrendChart();
        updateSegmentCharts();
        resetFileChoosers();
        updateLoadedFilesText(responses[0].filename + '; ' + responses[1].filename);
        if (firstRun) {
          appendRBtnsForTrendChart();
          appendElapTimeInputForTrendChart();
          firstRun = false;
        } else {
          UIProcessor.changeValueOfRadioBtsToSelectPm(constants.DEFAULT_PM_ID);
        }
        UIProcessor.hideProgressSpinner();
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function handleFileLoading (file, id) {
    if (id === 'pm') {
      pmCsvRequest = readSingleFile(file);
    } else {
      userTraceCsvRequest = readSingleFile(file);
    }
    if (pmCsvRequest && userTraceCsvRequest) {
      disableFileChoosers();
      UIProcessor.displayProgressSpinner();
      UIProcessor.displayMainContent();
      setTimeout(function () {
        run([pmCsvRequest, userTraceCsvRequest]);
      }, 500);
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

  function addDivForSegmentChart (segmentAction) {
    if (d3.select('#' + segmentAction).empty()) {
      d3.select('#' + constants.SEGMENTS_VIEWER_CONTAINER_ID)
        .append('div')
        .append('h4')
        .text(segmentAction)
        .append('div')
        .attr('id', segmentAction);
    }
  }

  function clearSegmentChartsContainer () {
    d3.select('#' + constants.SEGMENTS_VIEWER_CONTAINER_ID).html('');
  }

  function disableFileChoosers () {
    pmFileInput.setAttribute('disabled', true);
    userTraceFileInput.setAttribute('disabled', true);
    loadedFilesTextElement.innerHTML = '';
  }

  function resetFileChoosers () {
    pmFileInput.removeAttribute('disabled');
    userTraceFileInput.removeAttribute('disabled');
    pmFileInput.value = '';
    userTraceFileInput.value = '';
    pmCsvRequest = undefined;
    userTraceCsvRequest = undefined;
    updateLoadedFilesText('');
  }

  function updateLoadedFilesText (text) {
    loadedFilesTextElement.innerHTML = text;
  }

  function changeCurrentPm () {
    clearTrendChart(function () {
      updatePmInTrendChart();
      updateSegmentCharts();
      UIProcessor.hideProgressSpinner(TREND_PROGRESS_SPINNER_ID);
    });
  }

  function updateSegmentCharts () {
    let jointSegmentsInfo = performanceMeasuresTrace.getJointSegmentsInfo(currentPm);
    let segmentName;
    jointSegmentsInfo.forEach(function (jointSegmentInfo) {
      segmentName = jointSegmentInfo.segment.action;
      addDivForSegmentChart(segmentName);
      addTimeSeriesChartFromJSON(
        jointSegmentInfo.trendData,
        segmentName,
        generateKeysForSegmentChangeValue(segmentName),
        true
      );
    });
  }

  function clearTrendChart (onCleared) {
    trendsChart.unload({
      done: onCleared
    });
  }

  function updatePmInTrendChart () {
    let changeValueData = performanceMeasuresTrace.getChangeValueData(currentPm, true);
    updateDataOfTrendChart(changeValueData, generateKeysForSegmentsChangeValue(), true);
    addTrendLinesToTrendChart();
  }

  function addTrendLinesToTrendChart () {
    let json = [];
    let keys = [];
    let trendValueKey;
    let initValue;
    let finishValue;
    performanceMeasuresTrace.segmentsInfo.get(currentPm).forEach(function(segmentInfo, i) {
      trendValueKey = DataProcessor.generateTrendValueKey(segmentInfo.segmentName, i);
      keys.push(trendValueKey);
      initValue = {};
      initValue.time = segmentInfo.initTime;
      initValue[trendValueKey] = segmentInfo.initTrendValue;
      finishValue = {};
      finishValue.time = segmentInfo.finishTime;
      finishValue[trendValueKey] = segmentInfo.finishTrendValue;
      json.push(initValue);
      json.push(finishValue);
    });
    updateDataOfTrendChart(json, keys, false);
  }

  function updateDataOfTrendChart (json, keys, cleanChart, onloaded) {
    var loadData = generateDataObjectForTrendCharts(json, keys);
    if (cleanChart) {
      loadData.unload = [];
    }
    if (onloaded) {
      loadData.done = onloaded;
    }
    trendsChart.load(loadData);
  }

  function addTimeSeriesChartFromRows (rows, containerId, eventsMarks, onrendered, hideLegend, yRange) {
    let data = {
      rows: rows,
      x: 'TimeStamp'
    };
    return addChart(data, containerId, eventsMarks, onrendered, hideLegend, yRange);
  }

  function addTimeSeriesChartFromJSON (json, containerId, dataKeys, connectNull, eventsMarks, onrendered, hideLegend, yRange) {
    let data = generateDataObjectForTrendCharts(json, dataKeys);
    return addChart(data, containerId, eventsMarks, onrendered, hideLegend, yRange, connectNull);
  }
  
  function generateDataObjectForTrendCharts (json, keys) {
    return {
      json: json,
      keys: {
        x: 'time',
        value: keys
      }
    }
  }

  function generateKeysForSegmentsChangeValue () {
    let keysForSegmentsChangeValue = [];
    constants.segmentsOfInterest.forEach(function (segmentName, i) {
      keysForSegmentsChangeValue.push(DataProcessor.generateRelChangeValueKey(segmentName));
    });
    return keysForSegmentsChangeValue;
  }

  function generateKeysForSegmentChangeValue (segmentName) {
    return [
      DataProcessor.generateRelChangeValueKey(segmentName),
      DataProcessor.generateTrendValueKey(segmentName)
    ]
  }

  function addChart (data, containerId, eventsMarks, onrendered, hideLegend, yRange, connectNull) {
    var chartProperties = {
      data: data,
      axis: {
        x: {
          type: 'timeseries',
          tick: {
            format: function (x) {
              return x.toLocaleString('de-DE');
            }
          }
        }
      },
      bindto: '#' + containerId,
      size: {
        height: CHART_HEIGHT
      },
      zoom: {
        enabled: true
      }
    };
    if (connectNull) {
      chartProperties.line = {
        connectNull: true
      }
    }
    if (yRange) {
      chartProperties.axis.y = yRange;
    }
    if (eventsMarks) {
      chartProperties.grid = {
        x: {
          lines: eventsMarks
        }
      };
    };
    if (onrendered) {
      chartProperties.onrendered = onrendered;
    }
    if (hideLegend) {
      chartProperties.legend = {
        show: false
      };
    }
    return c3.generate(chartProperties);
  }

  function parseUserTraceAsGridLines (userTraces) {
    function getLineObject (userTrace) {
      return {
        text: userTrace.action,
        details: userTrace.details,
        value: userTrace.time,
        class: 'user-trace-grid-lines' + ' ' + (constants.userTraceActionsIds.hasOwnProperty(userTrace.action)
          ? constants.userTraceActionsIds[userTrace.action] : '')
      };
    }
    return buildGridLinesList(userTraces, getLineObject);
  }

  function buildGridLinesList (dataList, getLineObject) {
    var linesList = [];
    dataList.forEach(function (lineData) {
      linesList.push(getLineObject(lineData));
    });
    return linesList;
  }

  function addDetailsToUserTraceGridLines () {
    var gridLines = d3.selectAll('.user-trace-grid-lines text');
    gridLines.each(function (d) {
      if (d.details) {
        var title = d3.select(this).select('title');
        if (title.empty()) {
          title = gridLines.append('title');
        }
        title.text(function (d) {
          return d.details;
        });
      }
    });
  }

  function appendRBtnsForTrendChart () {
    constants.pmLogsInfo.get('pmIds').forEach(function (pmId) {
      var pmInput = createInputElement(pmId, constants.CURRENT_PM_GROUP_NAME, pmId === constants.DEFAULT_PM_ID);
      var labelText = pmId + ' ' + constants.pmLogsInfo.get(pmId).verbose;
      var pmLabel = UIProcessor.createLabelElement(pmId, labelText, 'form-check-label');
      var trendChartRBtnsDiv = document.querySelector('#' + constants.TREND_CHART_R_BTNS_DIV_ID);
      var inputGroupContainer = document.createElement('div');
      inputGroupContainer.setAttribute('class', 'form-check form-check-inline');
      inputGroupContainer.appendChild(pmInput);
      inputGroupContainer.appendChild(pmLabel);
      trendChartRBtnsDiv.appendChild(inputGroupContainer);
    });

    function createInputElement (id, name, checked) {
      var inputEl = document.createElement('input');
      inputEl.setAttribute('id', id);
      inputEl.setAttribute('value', id);
      inputEl.setAttribute('type', 'radio');
      inputEl.setAttribute('name', name);
      inputEl.setAttribute('class', 'form-check-input');
      if (checked) {
        inputEl.setAttribute('checked', checked);
      }
      inputEl.addEventListener('change', function (e) {
        setTimeout(function () {
          currentPm = this.value;
        }.bind(this), 500);
      });
      return inputEl;
    }
  }

  function appendElapTimeInputForTrendChart () {
    var elapTimeInput = UIProcessor.createElapTimeInputForSegments(function (newValue) {
      segmentDistance = parseInt(newValue);
    });
    var inputContainer = document.querySelector('#' + constants.TOLERANCE_TIME_DIV_ID);
    inputContainer.appendChild(elapTimeInput);
  }

  function updateTrendChartSegments (segmentDistance) {
    eventsTrace.updateSegmentsDistance(segmentDistance);
    performanceMeasuresTrace.updateSegments(eventsTrace.segments);
    updateTrendChartGrids();
  }

  function updateTrendChartGrids () {
    trendsChart.xgrids.remove();
    trendsChart.xgrids.add(parseUserTraceAsGridLines(eventsTrace.segments));
  }
}());
