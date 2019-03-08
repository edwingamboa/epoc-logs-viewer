/* global FileReader */

import '../styles/main_style.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'c3/c3.css';
import * as d3 from 'd3';
import c3 from 'c3';
import * as constants from './constants';
import EventsTrace from './events-trace';
import PerformanceMeasuresTrace from './performance-measures-trace';
import { UIProcessor } from './utils';

(function () {
  var pmFileInput = document.querySelector('#' + constants.PM_FILE_INPUT_ID);
  var userTraceFileInput = document.querySelector('#' + constants.UT_FILE_INPUT_ID);
  var loadedFilesTextElement = document.querySelector('#' + constants.LOADED_FILES_TEXT_ID);
  var pmCsvRequest;
  var userTraceCsvRequest;
  var trendsChart;
  var firstRun = true;
  var eventsTrace;
  var performanceMeasuresTrace;
  const CHART_HEIGHT = 300;

  pmFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'pm');
  });

  userTraceFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'ut');
  });

  function run (requests) {
    Promise.all(requests)
      .then(function (responses) {
        eventsTrace = new EventsTrace(responses[1].data);
        performanceMeasuresTrace = new PerformanceMeasuresTrace(responses[0].data, eventsTrace.segments);

        var userTraceEventsLines = parseUserTraceAsGridLines(eventsTrace.events);
        addChart(
          performanceMeasuresTrace.getData(true),
          constants.EPOC_MEASURES_CONTAINER_ID,
          userTraceEventsLines,
          addDetailsToUserTraceGridLines
        );

        var eventsOfInterestGridLines = parseUserTraceAsGridLines(eventsTrace.segments);
        trendsChart = addChart(
          performanceMeasuresTrace.getTrendData(constants.DEFAULT_PM_ID, true),
          constants.TRENDS_VIEWER_CONTAINER_ID,
          eventsOfInterestGridLines,
          addDetailsToUserTraceGridLines
        );

        var jointSegmentsInfo = performanceMeasuresTrace.getJointSegmentsInfo(constants.DEFAULT_PM_ID);
        console.log(jointSegmentsInfo);
        jointSegmentsInfo.forEach(function (jointSegmentInfo) {
          d3.select('#' + constants.SEGMENTS_VIEWER_CONTAINER_ID)
            .append('div')
            .append('h4')
            .text(jointSegmentInfo.segment.action)
            .append('div')
            .attr('id', jointSegmentInfo.segment.action)
          addChart(
            constants.TREND_DATA_HEAD_ROW.concat(jointSegmentInfo.trendData),
            jointSegmentInfo.segment.action
          );
        });
        resetFileChoosers();
        updateLoadedFilesText(responses[0].filename + '; ' + responses[1].filename);
        if (firstRun) {
          appendRBtnsForTrendChart();
          appendElapTimeInputForTrendChart();
          firstRun = false;
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

  function changeDataOfTrendChart (pmId, onloaded) {
    pmId = pmId || constants.DEFAULT_PM_ID;
    var relativeChangeValsAndEvents = performanceMeasuresTrace.getTrendData(pmId, true);
    var loadData = {
      rows: relativeChangeValsAndEvents,
      x: 'TimeStamp',
      unload: []
    };
    if (onloaded) {
      loadData.done = onloaded;
    }
    trendsChart.load(loadData);
  }

  function addChart (data, containerId, eventsMarks, onrendered, types) {
    var chartProperties = {
      data: {
        rows: data,
        x: 'TimeStamp'
      },
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
    if (types) {
      chartProperties.data = data;
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
      var pmInput = createInputElement(pmId, 'trendChartPM', pmId === constants.DEFAULT_PM_ID);
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
        changeDataOfTrendChart(this.value);
      });
      return inputEl;
    }
  }

  function appendElapTimeInputForTrendChart () {
    var elapTimeInput = UIProcessor.createElapTimeInputForSegments(function (newValue) {
      updateTrendChartSegments(parseInt(newValue));
    });
    var inputContainer = document.querySelector('#' + constants.TOLERANCE_TIME_DIV_ID);
    inputContainer.appendChild(elapTimeInput);
  }

  function updateTrendChartSegments (segmentDistance) {
    eventsTrace.updateSegmentsDistance(segmentDistance);
    updateTrendChartGrids();
    changeDataOfTrendChart(null, function () {
      trendsChart.flush();
    });
  }

  function updateTrendChartGrids () {
    trendsChart.xgrids.remove();
    trendsChart.xgrids.add(parseUserTraceAsGridLines(eventsTrace.segments));
  }
}());
