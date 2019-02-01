(function() {
  const EPOC_MEASURES_CONTAINER_ID = 'measuresViewer';
  const REGIONS_INDICATORS_CONTAINER_ID = 'regionsIndicators';
  const USER_TRACE_VIEWER_CONTAINER_ID = 'userTraceViewer';
  const USER_TRACE_INDICATORS_CONTAINER_ID = 'userTraceRegionsIndicators';
  const eventsData = [
    {
      id: 1,
      verbose: 'Eyes opened start'
    },
    {
      id: 2,
      verbose: 'Eyes opened end'
    },
    {
      id: 3,
      verbose: 'Eyes closed start'
    },
    {
      id: 4,
      verbose: 'Eyes closed end'
    },
    {
      id: 22,
      verbose: 'Kapitelwechsel'
    },
    {
      id: 23,
      verbose: 'Einschätzung'
    },
    {
      id: 24,
      verbose: 'Bewegung'
    },
    {
      id: 25,
      verbose: 'Störgeräusche'
    },
    {
      id: 26,
      verbose: 'Formel'
    },
    {
      id: 27,
      verbose: 'Begriffe'
    },
    {
      id: 28,
      verbose: 'Game/Quiz'
    },
    {
      id: 29,
      verbose: 'Fragebogen'
    },
    {
      id: 30,
      verbose: 'Texteingabe'
    }
  ];
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
  }
  const userTraceActionsData = [
    {
      id: 1,
      verbose: 'booklet_switch'
    },
    {
      id: 2,
      verbose: 'link'
    },
    {
      id: 3,
      verbose: 'navigate'
    },
    {
      id: 4,
      verbose: 'user_rating'
    }
  ];

  var userTraces;

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
      addPmChart(pmMeasures, eventsRegions, EPOC_MEASURES_CONTAINER_ID);
      addRegionsIndicators(eventsData, REGIONS_INDICATORS_CONTAINER_ID);

      var userTraceRegions = parseUserTraceAsRegionObjects(responses[2].data);
      addPmChart(pmMeasures, userTraceRegions, USER_TRACE_VIEWER_CONTAINER_ID);
      addRegionsIndicators(userTraceActionsData, USER_TRACE_INDICATORS_CONTAINER_ID);
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

  function addPmChart(pmMeasures, eventsRegions, containerId) {
    c3.generate({
      data: {
        rows: pmMeasures,
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
      },
      regions: eventsRegions
    });
  }

  function parseEventsAsRegionObjects(regionsAsCsv) {
    userTraces = extractRegionsOfInterest(regionsAsCsv);
    var regionsList = [];
    var region;
    userTraces.forEach(function(event, i) {
      region = {
        axis: 'x',
        start: event.time,
        class: 'region' + event.id
      };
      if (i < userTraces.length - 1) {
        region.end = userTraces[i + 1].time;
      }
      regionsList.push(region);
    });
    return regionsList;
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
        columns.splice(3); // Remove unneeded right columns
        dataRows.push({
          time: new Date(columns[0]),
          action: columns[1],
          actionDescription: columns[2],
        });
      }
    });
    return dataRows;
  }

  function parseUserTraceAsRegionObjects(regionsAsCsv) {
    userTraces = extractUserTraceEvents(regionsAsCsv);
    var regionsList = [];
    var region;
    userTraces.forEach(function(userTrace, i) {
      region = {
        axis: 'x',
        start: userTrace.time,
        class: 'region' + (userTraceActionsIds.hasOwnProperty(userTrace.action) ? 
          userTraceActionsIds[userTrace.action] : '')
      };
      if (i < userTraces.length - 1) {
        region.end = userTraces[i + 1].time;
      }
      regionsList.push(region);
    });
    return regionsList;
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

  function parseTimestampToElapseSecs(initialTime, timestamp) {
    return (timestamp - initialTime).toFixed(2);
  }

  function addRegionsIndicators(regionsData, containerId) {
    const indicatorHeightWidth = 15;
    const margin = 5;
    var containerSvg = d3
      .select('#' + containerId)
      .append('svg')
      .attr('height', calculateSvgHeight());

    var indicatorYCoordinate;
    var currentIndicatorGroup;
    regionsData.forEach(function(eventData, i) {
      indicatorYCoordinate = i * getIndicatorHeightWithMargin();
      currentIndicatorGroup = containerSvg
        .append('g')
        .attr('transform', 'translate(0,' + indicatorYCoordinate + ')');
      currentIndicatorGroup
        .append('rect')
        .attr('width', indicatorHeightWidth)
        .attr('height', indicatorHeightWidth)
        .attr('class', 'c3-region region' + eventData.id)
        .attr('x', 0)
        .attr('y', 0);
      currentIndicatorGroup
        .append('text')
        .attr('class', 'c3-legend-item')
        .text(eventData.verbose)
        .attr('height', indicatorHeightWidth)
        .attr('x', getIndicatorHeightWithMargin())
        .attr('y', 10);
    });

    function getIndicatorHeightWithMargin() {
      return indicatorHeightWidth + margin;
    }

    function calculateSvgHeight() {
      return eventsData.length * getIndicatorHeightWithMargin();
    }
  }
})();
