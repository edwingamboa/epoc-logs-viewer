(function () {
  const CONTAINER_ID = 'measuresViewer';
  const REGIONS_INDICATORS_ID = 'regionsIndicators';
  var eventsData = [{
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

  var performanceMeasuresList;
  var eventsList;
  var chartCsv;

  var performanceMeasuresRequest = requestPerformanceMeasures('data/itembuilder_2019.01.08_10.02.30.pm.csv');
  var eventsRequest = requestEventsCsv('data/itembuilder_2019.01.08_10.02.30.csv');

  Promise
    .all([performanceMeasuresRequest, eventsRequest])
    .then(function (responses) {
      var pmMeasures = extractScaPerformanceMeasuresFromCSV(responses[0].data)
      var eventsRegions = parseEventsAsRegionObjects(responses[1].data);
      addPmChart(pmMeasures, eventsRegions);
    })
    .catch(function (error) {
      console.log(error);
    });

  function requestPerformanceMeasures(url) {
    return axios
      .request({
        url: url,
        responseType: 'text'
      })
  }

  function requestEventsCsv(url) {
    return axios
      .request({
        url: url,
        responseType: 'text'
      })
  }

  function addPmChart (pmMeasures, eventsRegions) {
    console.log(pmMeasures, eventsRegions);
    chartCsv = c3.generate({
      data: {
        rows: pmMeasures,
        x: 'TimeStamp'
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
    eventsList.forEach(function (event, i) {
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
    csv.split('\n').map(function (line, index) {
      const MARKER_COLUMN_INDEX = 19;
      const NO_EVENT_ID = 0;
      var columns = line.split(',');
      var eventId = columns[MARKER_COLUMN_INDEX];
      // skip first line
      if (line !== '' && index > 0 && eventId != NO_EVENT_ID) {
        columns.splice(0, MARKER_COLUMN_INDEX);
        columns.splice(1, 2);
        columns.splice(2);
        columns = columns.map(function (column) {
          return parseInt(column);
        });
        dataRows.push({
          id: columns[0],
          time: columns[1]
        });
      }
    });
    return dataRows;
  }

  function extractScaPerformanceMeasuresFromCSV(csv) {
    var initialTime;
    var dataRows = csv.split('\n').map(function (line, index) {
      var columns = line.split(',');
      if (index === 1) {
        initialTime = parseFloat(columns[0]);
        columns[0] = 0;
      } else if (index > 1) {
        columns[0] = parseTimestampToElapseSecs(
          initialTime,
          parseFloat(columns[0])
        );
      }
      var firstPmColumn;
      var lastPmColumn = 8;
      var step = 4;
      for (firstPmColumn = 2; firstPmColumn < lastPmColumn; firstPmColumn++) {
        columns.splice(firstPmColumn, step);
      }
      columns.splice(lastPmColumn);

      return columns;
    });
    return dataRows;
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
    eventsData.forEach(function (eventData, i) {
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