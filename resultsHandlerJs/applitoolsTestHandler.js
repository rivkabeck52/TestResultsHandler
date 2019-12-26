const fs = require('fs');
const https = require('https');
var OnlyGetDiffs = false;
var dirStructure;


class ApplitoolsTestResultHandler {

  constructor(testResult, viewKey) {
    this.testResult = testResult;
    this.viewKey = viewKey;
    this.testName = this.testName();
    this.appName = this.appName();
    this.viewportSize = this.viewportSize();
    this.hostOS = this.hostingOS();
    this.hostApp = this.hostingApp();
    this.testURL = this.setTestURL();
    this.serverURL = this.setServerURL();
    this.batchId = this.setBatchID();
    this.sessionId = this.setSessionID();
    this.steps = this.steps();
  }

  stepStatusArray() {
    return this.getStepResults().map(obj => obj.status);
  }

  async downloadImages(dir, type) {
    if (dir === undefined || !fs.existsSync(dir)) {
      console.log(`Directory was undefined or non-existent. Saving images to: ${process.cwd()}`);
      dir = process.cwd();
    } else {
      console.log(`Saving images to: ${dir}`);
    }

    const imagesDir = this.directoryCreator(dir);
    const images = this.getImageUrls(type);
    for (let i = 0, len = images.length; i < len; i++) {
      const fileName = `${imagesDir}/${images[i][0]}`;
      const downloadUrl = (`${images[i][1]}?apiKey=${this.viewKey}`);

      if (type === "diff" & this.OnlyGetDiffs && this.testResult.stepsInfo[i].isDifferent)
        await this.downloadImage(fileName, downloadUrl);
      else if (!this.OnlyGetDiffs || type !== "diff")
        await this.downloadImage(fileName, downloadUrl);
    }
  }

  ///Private Methods
  testValues() {
    //return this.testResult.value_;
    return this.testResult;
  }

  testName() {
    return this.testValues().name;
  }

  appName() {
    return this.testValues().appName;
  }

  viewportSize() {
    const width = this.testValues().hostDisplaySize.width;
    const height = this.testValues().hostDisplaySize.height;
    return `${width}x${height}`;
  }

  hostingOS() {
    return this.testValues().hostOS;
  }

  hostingApp() {
    return this.testValues().hostApp;
  }

  setTestURL() {
    return this.testValues().appUrls.session;
  }

  setServerURL() {
    return this.testURL.split("/app")[0];
  }

  setBatchID() {
    return this.testValues().batchId;
  }

  setSessionID() {
    return this.testValues().id;
  }

  steps() {
    return this.testValues().steps;
  }

  getStepInfo(index) {
    return this.testValues().stepsInfo[index];
  }

  isTrue(a, b) {
    return !a.some((e, i) => e != b[i]);
  }

  getStepResults() {
    const stepResults = new Array;
    let status = new String;

    for (let i = 0; i < this.steps; ++i) {
      const isDifferent = this.getStepInfo(i).isDifferent;
      const hasBaselineImage = this.getStepInfo(i).hasBaselineImage;
      const hasCurrentImage = this.getStepInfo(i).hasCurrentImage;

      const bools = [isDifferent, hasBaselineImage, hasCurrentImage];

      const isNew = [false, false, true];
      const isMissing = [false, true, false];
      const isPassed = [false, true, true];
      const isFailed = [true, true, true];

      if (this.isTrue(isPassed, bools)) {
        status = "PASS"
      }

      if (this.isTrue(isMissing, bools)) {
        status = "MISSING"
      }

      if (this.isTrue(isNew, bools)) {
        status = "NEW"
      }

      if (this.isTrue(isFailed, bools)) {
        status = "FAIL"
      }

      const stepInfo = {
        step: i + 1,
        status,
        name: this.getStepInfo(i).name,
        baselineImage: this.getStepInfo(i).apiUrls.baselineImage,
        currentImage: this.getStepInfo(i).apiUrls.currentImage,
        diffImage: this.getStepInfo(i).apiUrls.diffImage
      };
      stepResults.push(stepInfo);
    }
    return stepResults;
  }

  directoryCreator(path) {

    if (this.dirStructure != undefined)
      dirStructure = this.dirStructure.concat([this.batchId, this.sessionId]);
    else {
      dirStructure = [this.testName, this.appName, this.viewportSize,
        this.hostOS, this.hostApp, this.batchId, this.sessionId];
    }

    const currentDir = process.cwd();
    process.chdir(path);

    dirStructure.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      process.chdir(dir);
    });
    process.chdir(currentDir);
    return (`${path}/${dirStructure.toString().replace(/,/g, '/')}`);
  }

  validateType(type) {
    const validTypes = ["baseline", "current", "diff"];
    if (validTypes.includes(type)) {
    } else {
      console.log(`Must set a valid type! types: ${validTypes}`)
      process.exit(-1);
    }
  }

  getImageUrls(type) {
    const images = this.getStepResults().map(obj => {
      const fileName = `${obj.step}-${obj.name}-${type}.png`;
      const imagesArray = {
        baseline: [fileName, obj.baselineImage],
        current: [fileName, obj.currentImage],
        diff: [fileName, obj.diffImage]
      };
      return imagesArray
    });

    this.validateType(type);
    const imageUrls = images.map(obj => {
      if (obj[type][1] != undefined) {
        return obj[type]
      }
    }).filter(n => n != undefined);

    if (imageUrls.length == 0) {
      console.log(`No ${type} images were found. Exiting...`)
      process.exit(-1); //Maybe return on this instead. Could exit out of script premature.
    }
    return imageUrls;
  }

  downloadImage(fileName, url) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(fileName);
      // console.log(url);
      const request = https.get(url);

      request.on('response', (response) => {
        response.pipe(file);
      });

      file.on('finish', () => {
        resolve();
      });
    });
  }

  setDownloadDiffOnly(getDiffsOnly) {
    this.OnlyGetDiffs = getDiffsOnly;

  }

  setDirStructure(DirStructure) {
    this.dirStructure = DirStructure;

  }
}

exports.ApplitoolsTestResultHandler = ApplitoolsTestResultHandler;