const Entity = require('./../engine/entity.js'),
  TextBlotter = require('./../common/textblotter.js'),
  inherits = require('inherits');

const TEXTBOX_BG_COLOR = 'rgba(0, 0, 0, 0.7)', // eslint-disable-line one-var
  TEXTBOX_CLOSE_TIME = 8,
  TEXTBOX_FINAL_DELAY = 30,
  TEXTBOX_LINES_PER_PAGE = 4,
  TEXTBOX_MAX_WIDTH = 96,
  TEXTBOX_OPEN_TIME = 10,
  TEXTBOX_PAGE_DELAY = 5,
  TEXTBOX_SCROLL_SPEEDS = [[0, 3], [75, 2], [150, 1]];

inherits(TextBox, Entity); // eslint-disable-line no-use-before-define

let nextLine = null;

function cleanString (text) { // eslint-disable-line no-unused-vars
  if (!text) {
    return text;
  }
  for (let i = 0; i < text.length; i++) {
    if (!TextBlotter.fontMap[text[i]]) {
      const charArray = text.split('');

      charArray.splice(i, 1);
      text = charArray.join('');
      i--;
    }
  }
  
  return text;
}

function calcScrollSpeed (text) {
  let speed = 1;

  for (let i = 0; i < TEXTBOX_SCROLL_SPEEDS.length; i++) {
    if (text.length >= TEXTBOX_SCROLL_SPEEDS[i][0]) { 
      speed = TEXTBOX_SCROLL_SPEEDS[i][1];
    } else if (text.length < TEXTBOX_SCROLL_SPEEDS[i][0]) { 
      break;
    }
  }
  
  return speed;
}

function TextBox (parent, text, stay) {
  this.parent = parent;
  this.text = text;
  this.screen = {
    x: 0,
    y: 0
  };
  this.sprite = { 
    keepOnScreen: true,
    screen: this.screen,
    parent: this.parent,
    stay,
    metrics: {
      x: 0,
      y: 0,
      w: 0,
      h: 0
    }
  };
}

TextBox.prototype.updateScreen = function () {
  if (!this.canvas) {
    return;
  }
  this.screen.x = this.parent.preciseScreen.x - this.canvas.width / 2 + this.parent.pixelSize.x;
  this.screen.y = this.parent.preciseScreen.y - this.canvas.height + 2;
};

TextBox.prototype.updateSprite = function () {
  this.sprite.image = this.canvas;
  this.sprite.metrics.w = this.sprite.image.width;
  this.sprite.metrics.h = this.sprite.image.height;
};

TextBox.prototype.blotText = function (options) {
  if (!options) { 
    options = {};
  }
  options.bg = options.bg || TEXTBOX_BG_COLOR;
  options.text = options.text || this.text;
  if (!options.text) { 
    return; 
  }
  this.canvas = TextBlotter.blot(options);
  this.updateScreen();
  this.updateSprite();
};

TextBox.prototype.scrollMessage = function (cb) {
  const self = this;

  function complete () {
    self.remove();
    cb();
  }
  this.textMetrics = TextBlotter.calculateMetrics({
    text: this.text,
    maxWidth: TEXTBOX_MAX_WIDTH
  });
  if (this.text.trim() === '' || this.textMetrics.lines.length === 0 || 
        this.textMetrics.lines[0].chars.length === 0) { // No message to show
    complete();
    
    return;
  }
  const scrollSpeed = calcScrollSpeed(this.text); // eslint-disable-line one-var
  let lineChar = 0,
    lineNumber = 0,
    lineChars = self.textMetrics.lines[lineNumber].chars.length; // eslint-disable-line sort-vars

  for (let nl = 1; nl < TEXTBOX_LINES_PER_PAGE; nl++) {
    nextLine = self.textMetrics.lines[lineNumber + nl];

    if (nextLine) { 
      lineChars += nextLine.chars.length; 
    } else {
      break;
    }
  }

  const addLetter = function () { // eslint-disable-line one-var
    lineChar++;
    self.blotText({ 
      text: self.text,
      metrics: self.textMetrics,
      maxChars: lineChar,
      lineStart: lineNumber,
      lineCount: TEXTBOX_LINES_PER_PAGE
    });
    if (lineChar === lineChars) { // Line set finished?
      lineNumber += TEXTBOX_LINES_PER_PAGE;
      if (lineNumber >= self.textMetrics.lines.length) { // Last line complete?
        self.tickDelay(() => {
          self.tickRepeat((progress) => {
            self.canvas = TextBlotter.transition({
              bg: TEXTBOX_BG_COLOR,
              metrics: self.textMetrics,
              progress: 1 - progress.percent, 
              lineCount: Math.min(self.textMetrics.lines.length, TEXTBOX_LINES_PER_PAGE)
            });
            self.updateScreen();
            self.updateSprite();
          }, TEXTBOX_CLOSE_TIME, complete);
        }, scrollSpeed * TEXTBOX_FINAL_DELAY);
      } else { // Still more lines
        lineChar = 0;
        lineChars = self.textMetrics.lines[lineNumber].chars.length;
        for (let nl = 1; nl < TEXTBOX_LINES_PER_PAGE; nl++) {
          nextLine = self.textMetrics.lines[lineNumber + nl];
          if (nextLine) {
            lineChars += nextLine.chars.length; 
          } else { 
            break;
          }
        }
        self.tickDelay(addLetter, scrollSpeed * TEXTBOX_PAGE_DELAY); // Begin next line
      }
    } else {
      self.tickDelay(addLetter, scrollSpeed);
    }
  };

  this.tickRepeat((progress) => {
    self.canvas = TextBlotter.transition({
      bg: TEXTBOX_BG_COLOR,
      metrics: self.textMetrics,
      progress: progress.percent,
      lineCount: Math.min(self.textMetrics.lines.length, TEXTBOX_LINES_PER_PAGE)
    });
    self.updateScreen();
    self.updateSprite();
  }, TEXTBOX_OPEN_TIME, () => {
    self.tickDelay(addLetter, scrollSpeed);
  });
};

module.exports = TextBox;