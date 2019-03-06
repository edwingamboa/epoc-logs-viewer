import * as constants from './constants';

class CsvProcessor {
  static extractLines (csv) {
    return csv.split('\n');
  }

  static getColumnsOfCsvLine (line, separator) {
    return line.split(separator || ',');
  }
}

class DateProcessor {
  static extractTimeHHMMSS (date) {
    return this.formatHHMMSS(date.getHours(), date.getMinutes(), date.getSeconds());
  }

  static elapsedSeconds (initTime, finishTime) {
    return Math.round(Math.abs(finishTime.getTime() - initTime.getTime()) / 1000);
  }

  static elapsedMinutes (initTime, finishTime) {
    return this.elapsedSeconds(initTime, finishTime) / 60;
  }

  static dateBasedOnTimeStampMs (timestamp) {
    return new Date(parseFloat(timestamp) * 1000);
  }

  static millisecondsToSeconds (milliseconds) {
    return milliseconds / 1000;
  }

  static secondsToHHMMSS (time) {
    let hours = Math.floor(time / 3600);
    time = time - hours * 3600;
    let minutes = Math.floor(time / 60);
    let seconds = time % 60;
    return this.formatHHMMSS(hours, minutes, seconds);
  }

  static formatHHMMSS (hours, minutes, seconds) {
    let timeWithLeadingZeros = [hours, minutes, seconds].map(function (time) {
      return this.addLeadingZeros(time);
    }.bind(this));
    return timeWithLeadingZeros.join(':');
  }

  static addLeadingZeros (string) {
    const length = 2;
    const pad = '0';
    return (new Array(length + 1).join(pad) + string).slice(-length);
  }
}

class UIProcessor {
  static displayMainContent () {
    let mainContentDiv = document.querySelector('#' + constants.MAIN_CONTENT_DIV_ID);
    this.displayElement(mainContentDiv);
  }

  static hideMainContent () {
    let mainContentDiv = document.querySelector('#' + constants.MAIN_CONTENT_DIV_ID);
    this.hideElement(mainContentDiv);
  }

  static displayProgressSpinner () {
    let progressSpinner = document.querySelector('#' + constants.PROGRESS_SPINNER_ID);
    this.displayElement(progressSpinner);
  }

  static hideProgressSpinner () {
    let progressSpinner = document.querySelector('#' + constants.PROGRESS_SPINNER_ID);
    this.hideElement(progressSpinner);
  }

  static hideElement (element) {
    element.classList.add('hidden');
  }

  static displayElement (element) {
    element.classList.remove('hidden');
  }

  static createElapTimeInputForSegments (listenerFunction) {
    var inputContainer = document.createElement('div');
    inputContainer.setAttribute('id', constants.TOLERANCE_TIME_DIV_ID);
    inputContainer.setAttribute('class', 'col form-group');

    var elapTimeInputId = 'elapseTimeInput';
    var elapTimeInput = this.createNumberInput(elapTimeInputId);
    var elapTimeLabel = this.createLabelElement(elapTimeInputId, 'Minimum seconds between events:');

    inputContainer.appendChild(elapTimeLabel);
    inputContainer.appendChild(elapTimeInput);

    elapTimeInput.addEventListener('change', function (e) {
      listenerFunction(this.value);
    });

    return inputContainer;
  }

  static createNumberInput (id) {
    var elapTimeInput = document.createElement('input');
    elapTimeInput.setAttribute('id', id);
    elapTimeInput.setAttribute('class', 'form-control');
    elapTimeInput.setAttribute('type', 'number');
    elapTimeInput.setAttribute('step', 1);
    elapTimeInput.setAttribute('min', 1);
    elapTimeInput.setAttribute('value', constants.DEFAULT_SEGMENT_DISTANCE);
    return elapTimeInput;
  }

  static createLabelElement (id, labelText, className) {
    var labelEl = document.createElement('label');
    labelEl.setAttribute('for', id);
    labelEl.innerHTML = labelText;
    if (className) {
      labelEl.setAttribute('class', className);
    }
    return labelEl;
  }
}

class NumberProcessor {
  static calculatePercentage (value, total) {
    return (value / total) * 100;
  }

  static round (value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
  }

  static calculateRoundedPercentage (value, total, decimals) {
    return this.round(this.calculatePercentage(value, total), decimals);
  }
}

export { CsvProcessor, DateProcessor, UIProcessor, NumberProcessor };
