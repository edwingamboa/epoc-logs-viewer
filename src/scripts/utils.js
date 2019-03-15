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

  static displayProgressSpinner (id) {
    if (!id) {
      id = constants.MAIN_PROGRESS_SPINNER_ID;
    }
    let progressSpinner = document.querySelector('#' + id);
    this.displayElement(progressSpinner);
  }

  static hideProgressSpinner (id) {
    if (!id) {
      id = constants.MAIN_PROGRESS_SPINNER_ID;
    }
    let progressSpinner = document.querySelector('#' + id);
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

  static changeValueOfRadioButtonGroup (value, groupName) {
    let groupSelector = `[name="${groupName}"]`;
    let valueSelector = `[value="${value}"]`;
    document.querySelector(`${groupSelector}${valueSelector}`).checked = true;
    document.querySelector(`${groupSelector}${valueSelector}`).setAttribute('checked', 'checked');
    document.querySelector(`${groupSelector}`).value = value;
  }

  static changeValueOfRadioBtsToSelectPm (pmId, groupName) {
    if (!groupName) {
      groupName = constants.CURRENT_PM_GROUP_NAME;
    }
    this.changeValueOfRadioButtonGroup(pmId, groupName);
  }

  static createRadioBtsToSelectPm (changeCallBack, groupName) {
    if (!groupName) {
      groupName = constants.CURRENT_PM_GROUP_NAME;
    }
    let radioButtonsContainer = document.createElement('div');
    constants.pmLogsInfo.get('pmIds').forEach(function (pmId) {
      let pmInput = this.createRadioButton(pmId, groupName, pmId === constants.DEFAULT_PM_ID, changeCallBack);
      let labelText = PmProcessor.generateVerboseOfPm(pmId);
      let pmLabel = this.createLabelElement(pmId, labelText, 'form-check-label');
      let inputGroupContainer = document.createElement('div');
      inputGroupContainer.setAttribute('class', 'form-check form-check-inline');
      inputGroupContainer.appendChild(pmInput);
      inputGroupContainer.appendChild(pmLabel);
      radioButtonsContainer.appendChild(inputGroupContainer);
    }.bind(this));
    return radioButtonsContainer;
  }

  static createRadioButton (id, name, checked, changeCallBack) {
    var radioButton = this.createInputElement(id, 'radio', 'form-check-input', changeCallBack, name);
    if (checked) {
      radioButton.setAttribute('checked', checked);
    }
    return radioButton;
  }

  static createInputElement (id, type, className, changeCallBack, name) {
    var inputEl = document.createElement('input');
    inputEl.setAttribute('id', id);
    inputEl.setAttribute('value', id);
    inputEl.setAttribute('type', type);
    if (name) {
      inputEl.setAttribute('name', name);
    }
    inputEl.setAttribute('class', className);
    inputEl.addEventListener('change', function (e) {
      changeCallBack(this.value);
    });
    return inputEl;
  }
}

class PmProcessor {
  static generateVerboseOfPm (pmId) {
    return constants.pmLogsInfo.get(pmId).verbose + ' (' + pmId + ')';
  }

  static getDesiredAdjective (pmId) {
    return constants.pmLogsInfo.get(pmId).desiredAdjective;
  }

  static getNotDesiredAdjective (pmId) {
    if (constants.pmLogsInfo.get(pmId).desiredAdjective.indexOf('Not ') > -1) {
      let adjective = constants.pmLogsInfo.get(pmId).desiredAdjective.replace('Not ', '');
      return adjective.charAt(0).toUpperCase() + adjective.substring(1);
    }
    return 'Not ' + constants.pmLogsInfo.get(pmId).desiredAdjective.toLowerCase();
  }

  static isNegativeConnoted (pmId) {
    return constants.pmLogsInfo.get(pmId).negativeConnoted;
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

class DataProcessor {
  static getColumnOfData (data, columnIndex) {
    let values = [];
    data.forEach(function (data) {
      let value = data[columnIndex];
      if (typeof value === 'string') {
        value = parseFloat(value);
      }
      values.push(value);
    });
    return values;
  }

  static generateRelChangeValueKey (segmentName) {
    return `relChangeValue_${segmentName}`
  }
}

export { CsvProcessor, DateProcessor, UIProcessor, NumberProcessor, PmProcessor, DataProcessor };
