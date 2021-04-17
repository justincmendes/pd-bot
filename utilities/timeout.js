const MAX_32_BIT_SIGNED_INT = 2147483647;

module.exports = {
  setLongTimeout(callback, delay) {
    var timeout;
    if (delay > MAX_32_BIT_SIGNED_INT) {
      timeout = setTimeout(
        () => this.setLongTimeout(callback, delay - MAX_32_BIT_SIGNED_INT),
        MAX_32_BIT_SIGNED_INT
      );
    } else timeout = setTimeout(callback, delay);
    return timeout;
  },

  setLongInterval(callback, delay) {
    var interval;
    if (delay > MAX_32_BIT_SIGNED_INT) {
      interval = this.setLongTimeout(callback, delay);
      const next = this.setLongTimeout(
        () => this.setLongInterval(callback, delay),
        delay
      );
    } else interval = setInterval(callback, delay);
    return interval;
  },
};
