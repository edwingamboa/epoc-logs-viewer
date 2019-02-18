import '../styles/main_style.css';
import '../styles/bootstrap.min.css';
import 'c3/c3.css';
import * as d3 from 'd3';
import * as ss from 'simple-statistics'
import c3 from 'c3';
import * as constants from './constants';

(function () {
  var pmFileInput = document.querySelector('#' + constants.PM_FILE_INPUT_ID);
  var userTraceFileInput = document.querySelector('#' + constants.UT_FILE_INPUT_ID);
  var loadedFilesTextElement = document.querySelector('#' + constants.LOADED_FILES_TEXT_ID);
  var pmCsvRequest;
  var userTraceCsvRequest;
  var pmMeasures;
  var segments;
  var userTraceLogs;
  var trendsChart;
  var firstRun = true;

  pmFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'pm');
  });

  userTraceFileInput.addEventListener('change', function (e) {
    handleFileLoading(e.target.files[0], 'ut');
  });

  function run (requests) {
    Promise.all(requests)
      .then(function (responses) {
        pmMeasures = extractScaPerformanceMeasuresFromCSV(responses[0].data);
        userTraceLogs = responses[1].data;
        var userTraceRegions = parseUserTraceAsGridLines(extractUserTraceEvents(userTraceLogs));

        addChart(
          pmMeasures,
          constants.EPOC_MEASURES_CONTAINER_ID,
          userTraceRegions,
          addDetailsToUserTraceGridLines
        );

        updateTrendSegments();

        var relativeChangeValsAndEvents = calculateTrendDataOfPm(pmMeasures, segments);
        var eventsOfInterestGridLines = parseUserTraceAsGridLines(segments);
        trendsChart = addChart(
          relativeChangeValsAndEvents,
          constants.TRENDS_VIEWER_CONTAINER_ID,
          eventsOfInterestGridLines,
          addDetailsToUserTraceGridLines
        );
        resetFileChoosers();
        updateLoadedFilesText(responses[0].filename + '; ' + responses[1].filename);
        if (firstRun) {
          appendRBtnsForTrendChart();
          appendElapTimeInputForTrendChart();
          firstRun = false;
        }
        switchToMainContent();
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function switchToMainContent () {
    var mainContentDiv = document.querySelector('#' + constants.MAIN_CONTENT_DIV_ID);
    mainContentDiv.style.display = 'block';
    var progressSpinner = document.querySelector('#' + constants.PROGRESS_SPINNER_ID);
    progressSpinner.style.display = 'none';
  }

  function switchToProgressSpinner () {
    var mainContentDiv = document.querySelector('#' + constants.MAIN_CONTENT_DIV_ID);
    mainContentDiv.style.display = 'none';
    var progressSpinner = document.querySelector('#' + constants.PROGRESS_SPINNER_ID);
    progressSpinner.style.display = 'block';
  }

  function handleFileLoading (file, id) {
    if (id === 'pm') {
      pmCsvRequest = readSingleFile(file);
    } else {
      userTraceCsvRequest = readSingleFile(file);
    }
    if (pmCsvRequest && userTraceCsvRequest) {
      disableFileChoosers();
      switchToProgressSpinner();
      run([pmCsvRequest, userTraceCsvRequest]);
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
    pmId = pmId || constants.DEFAULT_TREND_CHART_PM_ID;
    var relativeChangeValsAndEvents = calculateTrendDataOfPm(pmMeasures, segments, pmId);
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

  function requestCsv (url) { // eslint-disable-line no-unused-vars
    return axios.request({
      url: url,
      responseType: 'text'
    });
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

  function parseEventsAsRegionObjects (regionsAsCsv) { // eslint-disable-line no-unused-vars
    var events = extractRegionsOfInterest(regionsAsCsv);
    function getLineObject (event) {
      return {
        text: constants.epocEventsData.hasOwnProperty(event.id) ? constants.epocEventsData[event.id] : '',
        value: event.time,
        class: 'epoc-events-grid-lines' + event.id,
        position: 'start'
      };
    }
    return buildGridLinesList(events, getLineObject);
  }

  function extractRegionsOfInterest (csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function (line, index) {
      if (line !== '' && index > 0) {
        const MARKER_COLUMN_INDEX = 19;
        const NO_EVENT_ID = 0;
        var columns = getColumnsOfACsvLine(line);
        var eventId = columns[MARKER_COLUMN_INDEX];
        if (eventId !== NO_EVENT_ID) {
          columns.splice(0, MARKER_COLUMN_INDEX);
          columns.splice(1, 4); // Remove unneeded left columns
          columns.splice(4); // Remove unneeded right columns
          dataRows.push({
            id: parseInt(columns[0]),
            time: dateBasedOnTimeStampMs(columns[1])
          });
        }
      }
    });
    return dataRows;
  }

  function extractScaPerformanceMeasuresFromCSV (csv, desiredPms) {
    var dataRows = [];
    desiredPms = desiredPms || constants.pmLogsInfo.get('pmIds');
    getLinesOfCSV(csv).forEach(function (line, i) {
      if (line !== '') {
        var columns = getColumnsOfACsvLine(line);
        var newColumns = [];
        if (i > 0) {
          newColumns.push(
            dateBasedOnTimeStampMs(columns[constants.pmLogsInfo.get('TimeStamp').initCol])
          );
          desiredPms.forEach(function (pm) {
            newColumns.push(columns[constants.pmLogsInfo.get(pm).initCol]);
            constants.pmLogsInfo.get(pm).newCol = newColumns.length - 1;
          });
        } else {
          newColumns.push('TimeStamp');
          desiredPms.forEach(function (pm) {
            newColumns.push(pm + ' ' + constants.pmLogsInfo.get(pm).verbose);
          });
        }
        dataRows.push(newColumns);
      }
    });
    return dataRows;
  }

  function extractUserTraceEvents (csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function (line, index) {
      if (line !== '' && index > 0) {
        var columns = getColumnsOfACsvLine(line, ';');
        dataRows.push({
          time: new Date(columns[constants.traceLogsInfo.get('timestamp').initCol]),
          action: columns[constants.traceLogsInfo.get('action').initCol],
          details: columns.slice(constants.traceLogsInfo.get('action').initCol).join(' ')
        });
      }
    });
    return dataRows;
  }

  function extractSegmentsFromTraceEvents (
    csv, eventsOfInterest, columnOfTime, columnOfEvent, minElapsedSeconds
  ) {
    var segments = [];
    var lastSegmentInitTime;
    var lastSegmentAction;
    var currentSegmentInitTime;
    getLinesOfCSV(csv).forEach(function (line, index) {
      if (line !== '' && index > 0) {
        var columns = getColumnsOfACsvLine(line, ';');
        if (eventsOfInterest.indexOf(columns[columnOfEvent]) > -1) {
          currentSegmentInitTime = new Date(columns[columnOfTime]);
          if (!lastSegmentInitTime) {
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = columns[columnOfEvent];
          }
          if (lastSegmentInitTime &&
            elapsedSeconds(lastSegmentInitTime, currentSegmentInitTime) >= minElapsedSeconds) {
            segments.push({
              time: lastSegmentInitTime,
              finishTime: currentSegmentInitTime,
              action: lastSegmentAction,
              details: lastSegmentAction + ': ' + extractTimeHHMMSS(lastSegmentInitTime) + ' - ' + extractTimeHHMMSS(currentSegmentInitTime)
            });
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = columns[columnOfEvent];
          };
        }
      }
    });
    return segments;
  }

  function extractTimeHHMMSS (date) {
    return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
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

  function getLinesOfCSV (csv) {
    return csv.split('\n');
  }

  function getColumnsOfACsvLine (line, separator) {
    return line.split(separator || ',');
  }

  function dateBasedOnTimeStampMs (timestamp) {
    return new Date(parseFloat(timestamp) * 1000);
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

  function calculateTrendDataOfPm (pmList, segments, pmId) {
    pmId = pmId || 'SCA_ENG';
    const timeColumnIndex = constants.pmLogsInfo.get('TimeStamp').initCol;
    const columnIndex = constants.pmLogsInfo.get(pmId).newCol || constants.pmLogsInfo.get(pmId).initCol;

    var initialPmVal = pmList[1][columnIndex];
    var currentPmVal;
    var currentTime;
    var relEngChangeVals = [];

    pmList.slice(1).forEach(function (pm) {
      currentTime = pm[timeColumnIndex];
      currentPmVal = pm[columnIndex];
      relEngChangeVals.push([
        currentTime.getTime(),
        parseFloat(relativePmChange(currentPmVal, initialPmVal))
      ]);
    });

    var segmentsWithIndexes = addIndexesToSegments(segments, pmList.slice(1), timeColumnIndex);
    segmentsWithIndexes.forEach(function (segment) {
      if (segment.hasOwnProperty('initIndex')) {
        addTrendPoints(relEngChangeVals, segment.initIndex, segment.finishIndex || relEngChangeVals.length - 1);
      }
    });
    return [['TimeStamp', 'Relative Change', 'Trend']].concat(relEngChangeVals);
  }

  function addIndexesToSegments (segments, pmList, timeColumnIndex) {
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

  function addTrendPoints (data, segmentInitIndex, segmentFinalIndex) {
    var f = ss.linearRegressionLine(ss.linearRegression(data.slice(segmentInitIndex, segmentFinalIndex + 1)));
    data[segmentInitIndex][2] = f(data[segmentInitIndex][0]);
    data[segmentFinalIndex][2] = f(data[segmentFinalIndex][0]);
  }

  function elapsedSeconds (initTime, finishTime) {
    return Math.round(Math.abs(finishTime.getTime() - initTime.getTime()) / 1000);
  }

  function elapsedMinutes (initTime, finishTime) { // eslint-disable-line no-unused-vars
    return elapsedSeconds(initTime, finishTime) / 60;
  }

  function relativePmChange (currentPm, initialPm) {
    return (currentPm - initialPm) / initialPm;
  }

  function appendRBtnsForTrendChart () {
    constants.pmLogsInfo.get('pmIds').forEach(function (pmId) {
      var pmInput = createInputElement(pmId, 'trendChartPM', pmId === constants.DEFAULT_TREND_CHART_PM_ID);
      var labelText = pmId + ' ' + constants.pmLogsInfo.get(pmId).verbose;
      var pmLabel = createLabelElement(pmId, labelText, 'form-check-label');
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
    var elapTimeInputId = 'elapseTimeInput';
    var elapTimeInput = createNumberInput();
    var elapTimeLabel = createLabelElement(elapTimeInputId, 'Minimum seconds between events:');

    var inputContainer = document.querySelector('#' + constants.TOLERANCE_TIME_DIV_ID);
    inputContainer.appendChild(elapTimeLabel);
    inputContainer.appendChild(elapTimeInput);

    elapTimeInput.addEventListener('change', function (e) {
      updateTrendChartSegments(parseInt(this.value));
    });

    function createNumberInput (id) {
      var elapTimeInput = document.createElement('input');
      elapTimeInput.setAttribute('id', id);
      elapTimeInput.setAttribute('class', 'form-control');
      elapTimeInput.setAttribute('type', 'number');
      elapTimeInput.setAttribute('step', 10);
      elapTimeInput.setAttribute('min', 0);
      elapTimeInput.setAttribute('value', constants.DEFAULT_SEGMENT_DISTANCE);
      return elapTimeInput;
    }
  }

  function createLabelElement (id, labelText, className) {
    var labelEl = document.createElement('label');
    labelEl.setAttribute('for', id);
    labelEl.innerHTML = labelText;
    if (className) {
      labelEl.setAttribute('class', className);
    }
    return labelEl;
  }

  function updateTrendSegments (segmentDistance) {
    segments = extractSegmentsFromTraceEvents(
      userTraceLogs,
      constants.traceLogsInfo.get('actionD1').values.link,
      constants.traceLogsInfo.get('timestamp').initCol,
      constants.traceLogsInfo.get('actionD1').initCol,
      segmentDistance || constants.DEFAULT_SEGMENT_DISTANCE
    );
  }

  function updateTrendChartSegments (segmentDistance) {
    updateTrendSegments(segmentDistance);
    updateTrendChartGrids();
    changeDataOfTrendChart(null, function () {
      trendsChart.flush();
    });
  }

  function updateTrendChartGrids () {
    trendsChart.xgrids.remove();
    trendsChart.xgrids.add(parseUserTraceAsGridLines(segments));
  }
}());
