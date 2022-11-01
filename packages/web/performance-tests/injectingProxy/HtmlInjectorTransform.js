const { Transform } = require('stream');

exports.HtmlInjectorTransform = class HtmlInjectorTransform extends Transform {
  __scriptInjected = false;
  __wordIdx = 0;
  __contentIdx = 0;
  __content = [];

  constructor ({matchingSuffix, contentToInject}) {
    super();
    this.__word = matchingSuffix;
    this.__injectable = contentToInject;
  }

  _transform(chunk, enc, callback) {
    if (this.__scriptInjected) {
      this.push(chunk);
      callback();
      return;
    }

    const stringified = chunk.toString('utf-8');
    const arr = stringified.split('');

    this.__content.push(...arr);
    const hasMatch = this.__runPartialOnlineMatch();
    if (hasMatch) {
      this.__content.splice(this.__contentIdx, 0, this.__injectable);
      this.__scriptInjected = true;

      this.push(this.__content.join('', 'utf-8'));
      callback();

      this.__content = [];
    } else {
      const toFlush = this.__content.slice(0, this.__contentIdx);
      const toKeep = this.__content.slice(this.__contentIdx, this.__content.length);

      this.__content = toKeep;
      this.__contentIdx = 0;

      this.push(toFlush.join('', 'utf-8'));
      callback();
    }
  };

  __runPartialOnlineMatch() {
    while (true) {
      if (this.__contentIdx === this.__content.length) {
        return false;
      } else if (this.__wordIdx === this.__word.length) {
        return true;
      } else if (this.__contentIdx + this.__wordIdx === this.__content.length) {
        return false;
      } else if (this.__content[this.__contentIdx + this.__wordIdx] === this.__word[this.__wordIdx]) {
        this.__wordIdx++;
      } else if (this.__wordIdx === 0) {
        this.__contentIdx++;
      } else {
        // TODO: speed up using KMP failure function
        this.__wordIdx = 0;
        this.__contentIdx++;
      }
    }
  }
}
