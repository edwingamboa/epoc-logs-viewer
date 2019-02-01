(function() {
  const CONTAINER_ID = 'measuresViewer';
  const REGIONS_INDICATORS_ID = 'regionsIndicators';
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
  var eventsList;

  var performanceMeasuresRequest = requestPerformanceMeasures(
    'data/itembuilder_2019.01.08_10.02.30.pm.csv'
  );
  var eventsRequest = requestEventsCsv(
    'data/itembuilder_2019.01.08_10.02.30.csv'
  );

  Promise.all([performanceMeasuresRequest, eventsRequest])
    .then(function(responses) {
      var pmMeasures = extractScaPerformanceMeasuresFromCSV(responses[0].data);
      var eventsRegions = parseEventsAsRegionObjects(responses[1].data);
      addPmChart(pmMeasures, eventsRegions);
    })
    .catch(function(error) {
      console.log(error);
    });

  function requestPerformanceMeasures(url) {
    return axios.request({
      url: url,
      responseType: 'text'
    });
  }

  function requestEventsCsv(url) {
    return axios.request({
      url: url,
      responseType: 'text'
    });
  }

  function addPmChart(pmMeasures, eventsRegions) {
    chartCsv = c3.generate({
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
      bindto: '#' + CONTAINER_ID,
      zoom: {
        enabled: true
      },
      regions: eventsRegions
    });
    addRegionsIndicators();
  }

  function parseEventsAsRegionObjects(regionsAsCsv) {
    eventsList = extractRegionsOfInterest(regionsAsCsv);
    var regionsList = [];
    var region;
    eventsList.forEach(function(event, i) {
      region = {
        axis: 'x',
        start: event.time,
        class: 'region' + event.id
      };
      if (i < eventsList.length - 1) {
        region.end = eventsList[i + 1].time;
      }
      regionsList.push(region);
    });
    return regionsList;
  }

  function extractRegionsOfInterest(csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function(line, index) {
      const MARKER_COLUMN_INDEX = 19;
      const NO_EVENT_ID = 0;
      var columns = line.split(',');
      var eventId = columns[MARKER_COLUMN_INDEX];
      // skip first line
      if (line !== '' && index > 0 && eventId != NO_EVENT_ID) {
        columns.splice(0, MARKER_COLUMN_INDEX);
        columns.splice(1, 4);
        columns.splice(4); // Timestamp
        dataRows.push({
          id: parseInt(columns[0]),
          time: dateBasedOnTimeStampMs(columns[1])
        });
      }
    });
    return dataRows;
  }

  function extractScaPerformanceMeasuresFromCSV(csv) {
    var dataRows = [];
    getLinesOfCSV(csv).forEach(function(line, index) {
      if (line !== '') {
        var columns = line.split(',');
        // Add verbose (meaning) of performance measures ids
        if (index === 0) {
          columns = columns.map(getVerboseOfPM);
        } else {
          columns[0] = dateBasedOnTimeStampMs(columns[0]);
        }
        var firstPmColumn;
        var lastPmColumn = 8;
        var step = 4;
        for (firstPmColumn = 2; firstPmColumn < lastPmColumn; firstPmColumn++) {
          columns.splice(firstPmColumn, step);
        }
        columns.splice(lastPmColumn);

        dataRows.push(columns);
      }
    });
    return dataRows;
  }

  function getLinesOfCSV(csv) {
    return csv.split('\n');
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

  function addRegionsIndicators() {
    const indicatorHeightWidth = 15;
    const margin = 5;
    var containerSvg = d3
      .select('#' + REGIONS_INDICATORS_ID)
      .append('svg')
      .attr('height', calculateSvgHeight());

    var indicatorYCoordinate;
    var currentIndicatorGroup;
    eventsData.forEach(function(eventData, i) {
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
