(function() {
  const EPOC_MEASURES_CONTAINER_ID = 'measuresViewer';
  const TRENDS_VIEWER_CONTAINER_ID = 'trendsViewer';
  const PM_FILE_INPUT_ID = 'pmFileUrl';
  const UT_FILE_INPUT_ID = 'userTraceFileUrl';
  const LOADED_FILES_TEXT_ID = 'loadedFilesText';
  const eventsData = {
    '1':'Eyes opened start',
    '2': 'Eyes opened end',
    '3': 'Eyes closed start',
    '4': 'Eyes closed end',
    '22': 'Kapitelwechsel',
    '23': 'Einschätzung',
    '24': 'Bewegung',
    '25': 'Störgeräusche',
    '26': 'Formel',
    '27': 'Begriffe',
    '28': 'Game/Quiz',
    '29': 'Fragebogen',
    '30': 'Texteingabe'
  };
  const performanceMeasuresVerbose = {
    SCA_ENG: 'Engagement',
    SCA_VAL: 'Interest',
    SCA_MED: 'Relaxation',
    SCA_FRU: 'Stress',
    SCA_FOC: 'Focus',
    SCA_EXC: 'Excitement',
    SCA_LEX: 'Long-term excitement'
  };
  const userTraceActionsIds = {
    booklet_switch: 1,
    link: 2,
    navigate: 3,
    user_rating: 4
  };

  const linkValues = [
    'Link_Orientierung_xpage',
    'Link_Theorie_xpage',
    'Link_Grundprinzip_xpage',
    'Link_Berechnung_xpage',
    'Link_Raue_Oberflächen_xpage',
    'Link_Anwendung_xpage',
    'Link_FAQ_xpage',
    'Link_Zusammenfassung_xpage',
    'Link_Wiederholungsfragen_xpage',
    'Link_Quellen_xpage'
  ];

  var pmFileInput = document.querySelector('#' + PM_FILE_INPUT_ID);
  var userTraceFileInput = document.querySelector('#' + UT_FILE_INPUT_ID);
  var loadedFilesTextElement = document.querySelector('#' + LOADED_FILES_TEXT_ID);
  var pmCsvRequest;
  var userTraceCsvRequest;

  pmFileInput.addEventListener('change', function(e) {
    handleFileLoading(e.target.files[0], 'pm');
  });

  userTraceFileInput.addEventListener('change', function(e) {
    handleFileLoading(e.target.files[0], 'ut');
  });

  function handleFileLoading(file, id) {
    if (id === 'pm') {
      pmCsvRequest = readSingleFile(file);
    } else {
      userTraceCsvRequest = readSingleFile(file);
    }
    if (pmCsvRequest && userTraceCsvRequest) {
      disableFileChoosers();
      run([pmCsvRequest, userTraceCsvRequest]);
    }
  }

  function readSingleFile(file) {
    return new Promise (function (resolve, reject) {
      if (!file) {
        reject('Invalid file url');
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        resolve({
          data: e.target.result,
          filename: file.name
        });      
      };
      reader.readAsText(file);
    });
  }

  function disableFileChoosers() {
    pmFileInput.setAttribute('disabled', true);
    userTraceFileInput.setAttribute('disabled', true);
    loadedFilesTextElement.innerHTML = '';
  }

  function resetFileChoosers() {
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

  function run (requests) {
    Promise.all(requests)
    .then(function(responses) {
      var pmMeasures = extractScaPerformanceMeasuresFromCSV(responses[0].data);
      var userTraceRegions = parseUserTraceAsGridLines(extractUserTraceEvents(responses[1].data));
      
      addChart(
        pmMeasures,
        EPOC_MEASURES_CONTAINER_ID,
        userTraceRegions,
        addDetailsToUserTraceGridLines
        );

      var segments = extractSegmentsFromTraceEvents(responses[1].data, linkValues, 2, 5, 50);
      var relativeEngChanValsAndEvents = calculateTrendDataOfPm(pmMeasures, 1, 0, segments);
      var eventsOfInterestGridLines = parseUserTraceAsGridLines(segments);
      addChart(
        relativeEngChanValsAndEvents.changeVals,
        TRENDS_VIEWER_CONTAINER_ID,
        eventsOfInterestGridLines,
        addDetailsToUserTraceGridLines
      );
      resetFileChoosers();
      updateLoadedFilesText(responses[0].filename + '; ' + responses[1].filename);
    })
    .catch(function(error) {
      console.error(error);
    });
  }

  function requestCsv(url) {
    return axios.request({
      url: url,
      responseType: 'text'
    });
  }

  function addChart(data, containerId, eventsMarks, onrendered, types) {
    var chartProperties = {
      data: {
        rows: data,
        x: 'TimeStamp'
      },
      axis: {
        x: {
          type: 'timeseries',
          tick: {
            format: function(x) {
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
      }
    };
    if (onrendered) {
      chartProperties.onrendered = onrendered;
    }
    if (types) {
      chartProperties.data = data;
    }
    chartProperties.data = 
    c3.generate(chartProperties);
  }

  function parseEventsAsRegionObjects(regionsAsCsv) {
    var events = extractRegionsOfInterest(regionsAsCsv);
    function getLineObject(event){
      return {
        text: eventsData.hasOwnProperty(event.id) ? eventsData[event.id] : '',
        value: event.time,
        class: 'epoc-events-grid-lines' + event.id,
        position: 'start'
      }
    }
    return buildGridLinesList(events, getLineObject);
  }

  function extractRegionsOfInterest(csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function(line, index) {
      if (line !== '' && index > 0) {
        const MARKER_COLUMN_INDEX = 19;
        const NO_EVENT_ID = 0;
        var columns = getColumnsOfACsvLine(line);
        var eventId = columns[MARKER_COLUMN_INDEX];
        if (eventId != NO_EVENT_ID) {
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

  function extractScaPerformanceMeasuresFromCSV(csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function(line, index) {
      if (line !== '') {
        var columns = getColumnsOfACsvLine(line);
        // Add verbose (meaning) of performance measures ids
        if (index === 0) {
          columns = columns.map(getVerboseOfPM);
        } else {
          columns[0] = dateBasedOnTimeStampMs(columns[0]);
        }
        var firstPmColumn;
        const lastPmColumn = 8;
        const step = 4;
        for (firstPmColumn = 2; firstPmColumn < lastPmColumn; firstPmColumn++) {
          columns.splice(firstPmColumn, step);
        }
        columns.splice(lastPmColumn);

        dataRows.push(columns);
      }
    });
    return dataRows;
  }

  function extractUserTraceEvents(csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function(line, index) {
      if (line !== '' && index > 0) {
        var columns = getColumnsOfACsvLine(line, ';');
        columns.splice(0, 2);
        columns.splice(1, 1); // Remove unneeded column
        dataRows.push({
          time: new Date(columns[0]),
          action: columns[1],
          details: columns.slice(2).join(' ')
        });
      }
    });
    return dataRows;
  }

  function extractSegmentsFromTraceEvents(
    csv, eventsOfInterest, columnOfTime, columnOfEvent, minElapsedSeconds
    ) {
    var segments = [];
    var lastSegmentInitTime;
    var lastSegmentAction;
    var currentSegmentInitTime;
    getLinesOfCSV(csv).forEach(function(line, index) {
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
              details: lastSegmentAction + ': ' + extractTimeHH_MM_SS(lastSegmentInitTime) + ' - ' + extractTimeHH_MM_SS(currentSegmentInitTime)
            });
            lastSegmentInitTime = currentSegmentInitTime;
            lastSegmentAction = columns[columnOfEvent];
          }        
        }
      }
    });
    return segments;
  }

  function extractTimeHH_MM_SS(date) {
    return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
  }

  function parseUserTraceAsGridLines(userTraces) {
    function getLineObject(userTrace){
      return {
        text: userTrace.action,
        details: userTrace.details,
        value: userTrace.time,
        class: 'user-trace-grid-lines' + ' ' + (userTraceActionsIds.hasOwnProperty(userTrace.action) ? 
          userTraceActionsIds[userTrace.action] : '')
      }
    }
    return buildGridLinesList(userTraces, getLineObject);
  }

  function buildGridLinesList(dataList, getLineObject) {
    var linesList = [];
    dataList.forEach(function(lineData) {
      linesList.push(getLineObject(lineData));
    });
    return linesList;
  }

  function getLinesOfCSV(csv) {
    return csv.split('\n');
  }

  function getColumnsOfACsvLine(line, separator) {
    return line.split(separator ? separator : ',');
  }

  function dateBasedOnTimeStampMs(timestamp) {
    return new Date(parseFloat(timestamp) * 1000);
  }

  function getVerboseOfPM(pmId) {
    return (
      pmId +
      (performanceMeasuresVerbose.hasOwnProperty(pmId)
        ? ', ' + performanceMeasuresVerbose[pmId]
        : '')
    );
  }

  function addDetailsToUserTraceGridLines() {
    var gridLines = d3.selectAll('.user-trace-grid-lines text');
    gridLines.each(function (d) {
      if (d.details) {
        var title = d3.select(this).select('title');
        if (title.empty()) {
          title = gridLines.append('title');
        }
        title.text (function (d) {
          return d.details;
        })
      }
    });
  }

  function calculateTrendDataOfPm (pmList, engColumnIndex, timeColumnIndex, segments) {
    var initialEng = pmList[1][engColumnIndex];
    var currentEng;
    var currentTime;
    var relEngChangeVals = [];

    pmList.slice(1).forEach(function(pm) {
      currentTime = pm[timeColumnIndex];
      currentEng = pm[engColumnIndex];
      relativeEngChange = relativeEngagementChange(currentEng, initialEng)
      relEngChangeVals.push([currentTime.getTime(), parseFloat(relativeEngChange)]);
    });

    var segmentsWithIndexes = addIndexesToSegments(segments, pmList.slice(1), timeColumnIndex);
    segmentsWithIndexes.forEach(function (segment) {
      if (segment.hasOwnProperty('initIndex')) {
        addTrendPoints(relEngChangeVals, segment.initIndex, segment.finishIndex || relEngChangeVals.length - 1);
      }
    });
    return { 
      changeVals: [['TimeStamp', 'Relative Eng. Change', 'TrendPoint']].concat(relEngChangeVals)
    };
  }

  function addIndexesToSegments (segments, pmList, timeColumnIndex) {
    var pmListIndex = 0;
    segments.map(function (segment, i) {
      while(pmListIndex < pmList.length &&
        segment.time > pmList[pmListIndex][timeColumnIndex]) {
        pmListIndex ++;
      }
      if (pmListIndex < pmList.length) {
        segment.initIndex = pmListIndex;
        if (i > 0) {
          segments[i-1].finishIndex = pmListIndex - 1;
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
    return Math.round(Math.abs(finishTime.getTime() - initTime.getTime())/1000)
  }

  function elapsedMinutes (initTime, finishTime) {
    return elapsedSeconds(initTime, finishTime) / 60;
  }

  function relativeEngagementChange (currentEng, initialEng) {
    return (currentEng - initialEng) / initialEng;
  }
}());
