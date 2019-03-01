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
    return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
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
}

class UIProcessor {
  static switchToMainContent () {
    let mainContentDiv = document.querySelector('#' + constants.MAIN_CONTENT_DIV_ID);
    mainContentDiv.style.display = 'block';
    let progressSpinner = document.querySelector('#' + constants.PROGRESS_SPINNER_ID);
    progressSpinner.style.display = 'none';
  }

  static switchToProgressSpinner () {
    let mainContentDiv = document.querySelector('#' + constants.MAIN_CONTENT_DIV_ID);
    mainContentDiv.style.display = 'none';
    let progressSpinner = document.querySelector('#' + constants.PROGRESS_SPINNER_ID);
    progressSpinner.style.display = 'block';
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
