import '../styles/main_style.css';
import '../styles/bootstrap.min.css';
import EventsTrace from './events-trace';
import PerformanceMeasuresTrace from './performance-measures-trace';
import * as constants from './constants';



(function () {
  var pmFileInput = document.querySelector('#' + constants.PM_FILE_INPUT_ID);
  var userTraceFileInput = document.querySelector('#' + constants.UT_FILE_INPUT_ID);
  var loadedFilesTextElement = document.querySelector('#' + constants.LOADED_FILES_TEXT_ID);
  var addTracesBtn = document.querySelector('#' + constants.ADD_FILE_BUTTON_ID);
  var firstRun = true;
  var eventsTraces = [];
  var performanceMeasuresTraces = [];
  var pmCsvRequest;
  var userTraceCsvRequest;

  function addUserTraces (requests) {
    Promise.all(requests)
      .then(function (responses) {
        let eventsTrace = new EventsTrace(responses[1].data);
        eventsTraces.push(eventsTrace);
        performanceMeasuresTraces.push(new PerformanceMeasuresTrace(responses[0].data, eventsTrace.segments));

        console.log(eventsTraces);
        console.log(performanceMeasuresTraces);
        
        resetFileChoosers();
        appendTextToFilesText(responses[0].filename + ', ' + responses[1].filename + '; ');
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
