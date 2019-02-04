(function() {
  const EPOC_MEASURES_CONTAINER_ID = 'measuresViewer';
  const TRENDS_VIEWER_CONTAINER_ID = 'trendsViewer';
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

  var performanceMeasuresRequest = requestCsv(
    'data/itembuilder_2019.01.08_10.02.30.pm.csv'
  );
  var eventsRequest = requestCsv(
    'data/itembuilder_2019.01.08_10.02.30.csv'
  );

  var userTraceRequest = requestCsv(
    'data/Trace_user602.csv'
  );

  Promise.all([performanceMeasuresRequest, eventsRequest, userTraceRequest])
    .then(function(responses) {
      var pmMeasures = extractScaPerformanceMeasuresFromCSV(responses[0].data);
      var eventsRegions = parseEventsAsRegionObjects(responses[1].data);
      var userTraceRegions = parseUserTraceAsGridLines(responses[2].data);
      
      addChart(
        pmMeasures,
        EPOC_MEASURES_CONTAINER_ID,
        eventsRegions.concat(userTraceRegions),
        addDetailsToUserTraceGridLines
        );

      var relativeEngChanValsAndEvents = calculateTrendDataOfPm(pmMeasures, 1, 0);
      addChart(
        relativeEngChanValsAndEvents.changeVals,
        TRENDS_VIEWER_CONTAINER_ID,
        relativeEngChanValsAndEvents.eventsLines
      );
    })
    .catch(function(error) {
      console.error(error);
    });

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
      if (line !== ''&& index > 0) {
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

  function parseUserTraceAsGridLines(linesAsCsv) {
    var userTraces = extractUserTraceEvents(linesAsCsv);

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
          return d.text + ': ' + d.details;
        })
      }
    });
  }

  function calculateTrendDataOfPm (pmList, engColumnIndex, timeColumnIndex) {
    var initialTime = pmList[1][timeColumnIndex];
    var initialEng = pmList[1][engColumnIndex];
    var currentEng;
    var currentTime;
    var relEngChangeVals = [];
    var eventsLines = [];
    var segmentInitIndex = 0;
    pmList.slice(1).forEach(function(pm, i) {
      currentTime = pm[timeColumnIndex];
      currentEng = pm[engColumnIndex];
      relativeEngChange = relativeEngagementChange(currentEng, initialEng)
      relEngChangeVals.push([currentTime.getTime(), parseFloat(currentEng)]);
      if ((currentTime.getMinutes() - initialTime.getMinutes()) === 3) {
        // Trend Line
        var f = ss.linearRegressionLine(ss.linearRegression(relEngChangeVals.slice(segmentInitIndex, i)));
        var lastIndex = relEngChangeVals.length -1;
        relEngChangeVals[segmentInitIndex][2] = f(relEngChangeVals[segmentInitIndex][0]);
        relEngChangeVals[i][2] = f(relEngChangeVals[i][0]);
        // Update data for new Segment
        initialEng = currentEng;
        eventsLines.push({ value: currentTime });
        initialTime = currentTime;
        segmentInitIndex = i;
      }
    });

    return { 
      eventsLines: eventsLines,
      changeVals: [['TimeStamp', 'Relative Eng. Change', 'TrendPoint']].concat(relEngChangeVals)
    };
  }

  function relativeEngagementChange (currentEng, initialEng) {
    return (currentEng - initialEng) / initialEng;
  }
})();
