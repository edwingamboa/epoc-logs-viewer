export const EPOC_MEASURES_CONTAINER_ID = 'measuresViewer';
export const TRENDS_VIEWER_CONTAINER_ID = 'trendsViewer';
export const SEGMENTS_VIEWER_CONTAINER_ID = 'segmentsViewer';
export const PM_FILE_INPUT_ID = 'pmFileUrl';
export const UT_FILE_INPUT_ID = 'userTraceFileUrl';
export const LOGS_FILE_INPUT_ID = 'logsUrl';
export const LOADED_FILES_TEXT_ID = 'loadedFilesText';
export const TREND_CHART_R_BTNS_DIV_ID = 'trendChartPmRBtnsDiv';
export const DEFAULT_PM_ID = 'SCA_ENG';
export const TOLERANCE_TIME_DIV_ID = 'toleranceElapTimeEvents';
export const MAIN_CONTENT_DIV_ID = 'mainContent';
export const PROGRESS_SPINNER_ID = 'progressSpinner';
export const ADD_FILE_BUTTON_ID = 'addTraces';
export const CURRENT_PM_GROUP_NAME = 'currentPm';
export const CURRENT_PM_SELECTION_DIV_ID = 'currentPmSelectionDiv';
export const TREND_DATA_HEAD_ROW = [['TimeStamp', 'Relative Change', 'Trend']];
export const DEFAULT_SEGMENT_DISTANCE = 1;
export const epocEventsData = {
  '1': 'Eyes opened start',
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

export const userTraceActionsIds = {
  booklet_switch: 1,
  link: 2,
  navigate: 3,
  user_rating: 4
};

export const pmLogsInfo = new Map([
  ['TimeStamp', { initCol: 0, verbose: 'Time Stamp' }],
  ['SCA_ENG', { initCol: 1, verbose: 'Engagement', desiredAdjective: 'Engaged' }],
  ['SCA_VAL', { initCol: 6, verbose: 'Interest', desiredAdjective: 'Interested' }],
  ['SCA_MED', { initCol: 11, verbose: 'Relaxation', desiredAdjective: 'Relaxed' }],
  ['SCA_FRU', { initCol: 16, verbose: 'Stress', desiredAdjective: 'Not stressed', negativeConnoted: true }],
  ['SCA_FOC', { initCol: 21, verbose: 'Focus', desiredAdjective: 'Focused' }],
  ['SCA_EXC', { initCol: 26, verbose: 'Excitement', desiredAdjective: 'Excited' }],
  ['SCA_LEX', { initCol: 31, verbose: 'Long-term excitement', desiredAdjective: 'Long term excited' }],
  ['pmIds', ['SCA_ENG', 'SCA_VAL', 'SCA_MED', 'SCA_FRU', 'SCA_FOC', 'SCA_EXC', 'SCA_LEX']]
]);

export const linkEvents = [
  'Link_Orientierung_xpage',
  'Link_Theorie_xpage',
  'Link_Grundprinzip_xpage',
  'Link_Berechnung_xpage',
  'Link_Raue_Oberflächen_xpage',
  'Link_Anwendung_xpage',
  'Link_FAQ_xpage',
  'Link_Zusammenfassung_xpage',
  'Link_Wiederholungsfragen_xpage',
  'Link_Quellen_xpage',
  'Link_Instruktion_xpage'
];

export const segmentsOfInterest = [
  'Link_Orientierung_xpage',
  'Link_Theorie_xpage',
  'Link_Grundprinzip_xpage',
  'Link_Berechnung_xpage',
  'Link_Raue_Oberflächen_xpage',
  'Link_Anwendung_xpage',
  'Link_FAQ_xpage',
  'Link_Zusammenfassung_xpage',
  'Link_Wiederholungsfragen_xpage',
  'Link_Quellen_xpage',
  'Link_Instruktion_xpage'
];
