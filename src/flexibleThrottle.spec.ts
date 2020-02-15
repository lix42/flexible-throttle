/* eslint-disable jest/expect-expect */
import { flexibleThrottle } from "./flexibleThrottle";

describe("flexibleThrottle", () => {
  const cb = jest.fn();

  const MOCK_INIT_TIME = 10000;
  let mockCurrentTime: number;
  const mockDateNow = jest.fn();
  const advanceTimers = (time: number) => {
    mockCurrentTime += time;
    jest.advanceTimersByTime(time);
  };

  /**
   * [0]:number wait time
   * [1]:boolean to call the throttled function or not
   * [2]:number how many times does the real function be called
   */
  type TestInputType = [number, boolean, number]; // wait time, to call the function, called times
  const expectHaveBeenCalledAtTime = (
    throttledFunctions: Function,
    callback: Function,
    timePoints: TestInputType[]
  ): void => {
    expect(callback).toHaveBeenCalledTimes(0);
    timePoints.forEach(([time, toCall, times]) => {
      setTimeout(() => {
        if (toCall) {
          throttledFunctions();
        }
        expect(callback).toHaveBeenCalledTimes(times);
      }, time);
    });
    timePoints.forEach((entry, index) => {
      advanceTimers(index === 0 ? entry[0] : entry[0] - timePoints[index - 1][0]);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockDateNow.mockClear();
    mockDateNow.mockImplementation(() => mockCurrentTime);
    cb.mockClear();
    mockCurrentTime = MOCK_INIT_TIME;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("should return undefined if no callback is given", () => {
    expect(flexibleThrottle(undefined, 1000)).toBeUndefined();
  });

  it("should return undefined if no valid timeout is given", () => {
    expect(flexibleThrottle(cb, NaN)).toBeUndefined();
    expect(flexibleThrottle(cb, -1)).toBeUndefined();
  });

  it("should return undefined if both leading and tailing are disabled", () => {
    expect(flexibleThrottle(cb, 1000, { leading: false, tailing: false }, mockDateNow)).toBeUndefined();
  });

  describe("leading only", () => {
    it("one time call should call the callback immediately and only callback once", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: true, tailing: false }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 1],
        [500, false, 1],
        [1100, false, 1],
      ]);
    });

    it("should group multiple calls in to a single call", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: true, tailing: false }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 1],
        [500, true, 1],
        [800, true, 1],
        [1100, false, 1],
      ]);
    });

    it("should start new group call after the wait time", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: true, tailing: false }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 1],
        [500, true, 1],
        [800, true, 1],
        [1100, true, 2],
        [1500, true, 2],
        [2500, false, 2],
      ]);
    });
  });

  describe("tailing only", () => {
    it("one time call should call the callback at the time window end and only callback once", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: false, tailing: true }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 0],
        [500, false, 0],
        [1001, false, 1],
      ]);
    });

    it("should group multiple calls in to a single call", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: false, tailing: true }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 0],
        [500, true, 0],
        [800, true, 0],
        [1010, false, 1],
      ]);
    });

    it("should start new group call after the current time window", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: false, tailing: true }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 0],
        [500, true, 0],
        [800, true, 0],
        [1001, false, 1],
        [1500, true, 1],
        [1800, true, 1],
        [2100, false, 1],
        [2501, false, 2],
      ]);
    });
  });

  describe("leading and tailing", () => {
    it("one time call should call the callback immediately and only callback once", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: true, tailing: true }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 1],
        [500, false, 1],
        [1001, false, 1],
      ]);
    });

    it("should group multiple calls at the window start and end", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: true, tailing: true }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 1],
        [500, true, 1],
        [800, true, 1],
        [1001, false, 2],
      ]);
    });

    it("should start new group call after the current time window", () => {
      const fn = flexibleThrottle(cb, 1000, { leading: true, tailing: true }, mockDateNow);
      expectHaveBeenCalledAtTime(fn, cb, [
        [0, true, 1],
        [500, true, 1],
        [800, true, 1],
        [1001, false, 2],
        [1500, true, 3],
        [1800, true, 3],
        [2002, false, 3],
        [2501, false, 4],
      ]);
    });
  });

  describe("timeout as 0", () => {
    const expectLeadingCase = (throttled, raw) => {
      expect(raw).toHaveBeenCalledTimes(0);
      throttled();
      expect(raw).toHaveBeenCalledTimes(1);
      advanceTimers(10);
      expect(raw).toHaveBeenCalledTimes(1);
    };

    it("should callback immediately and callback only once if only leading is true", () => {
      const fn = flexibleThrottle(cb, 0, { leading: true, tailing: false }, mockDateNow);
      expectLeadingCase(fn, cb);
    });
    it("should callback at next tick and callback only once if only tailing is true", () => {
      const fn = flexibleThrottle(cb, 0, { leading: false, tailing: true }, mockDateNow);
      expect(cb).toHaveBeenCalledTimes(0);
      fn();
      expect(cb).toHaveBeenCalledTimes(0);
      setTimeout(() => {
        expect(cb).toHaveBeenCalledTimes(1);
      }, 0);
      advanceTimers(10);
    });
    it("should act as only leading is true when both leading and tailing are set", () => {
      const fn = flexibleThrottle(cb, 0, { leading: true, tailing: true }, mockDateNow);
      expectLeadingCase(fn, cb);
    });
  });

  it("should use jitter to patch the wait time if given", () => {
    const jitter = () => 123;
    const fn = flexibleThrottle(cb, 1000, { jitter, leading: false, tailing: true }, mockDateNow);
    expect(setTimeout).not.toHaveBeenCalled();
    fn();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000 + 123);
  });

  describe("call with override parameter", () => {
    /**
     * [0]:number wait time
     * [1]:number the parameter used in calling the throttle function, -1 means not call
     * [2]:number how many times does the real function be called at this moment
     */
    type TestOverrideInputType = [number, number, number];
    const expectHaveBeenCalledWithOverrideAtTime = (
      throttledFunctions: Function,
      callback: Function,
      timePoints: TestOverrideInputType[]
    ): void => {
      expect(callback).toHaveBeenCalledTimes(0);
      timePoints.forEach(([time, param, times]) => {
        setTimeout(() => {
          if (param >= 0) {
            throttledFunctions(param);
          }
          expect(callback).toHaveBeenCalledTimes(times);
        }, time);
      });
      timePoints.forEach((entry, index) => {
        advanceTimers(index === 0 ? entry[0] : entry[0] - timePoints[index - 1][0]);
      });
    };

    describe("leading only", () => {
      it("should use override parameter to set timer", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: false }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 1000, 1],
          [500, 1000, 1],
          [800, 1000, 1],
          [1100, 1000, 2],
          [1500, 1000, 2],
          [2500, -1, 2],
        ]);
      });

      it("should skip the call if it is still in cool down based on the override value", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: false }, mockDateNow);
        // although the default and the previous call use 500 timeout, but the override value 1000 will be skipped at time 800
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 1],
          [800, 1000, 1],
          [2000, -1, 1],
        ]);
      });

      it("should make a new call if it is out of cool down based on the override value", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: false }, mockDateNow);
        // although the default and the previous call use 500 timeout, but the override value 200 will be start a new group at time 300
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 1],
          [300, 200, 2],
          [2000, -1, 2],
        ]);
      });
    });

    describe("tailing only", () => {
      it("should use override parameter to set timer", () => {
        const fn = flexibleThrottle(cb, 500, { leading: false, tailing: true }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 1000, 0],
          [500, 1000, 0],
          [800, 1000, 0],
          [1100, 1000, 1],
          [1500, 1000, 1],
          [2500, -1, 2],
        ]);
      });

      it("should not delay the tailing point based on the override value", () => {
        const fn = flexibleThrottle(cb, 500, { leading: false, tailing: true }, mockDateNow);
        // the tailing call should happen at 500, although the override value is 1000, the tailing should not be changed
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 0],
          [200, 1000, 0],
          [501, -1, 1],
          [2000, -1, 1],
        ]);
      });

      it("should modify the tailing point if override to a shorter time", () => {
        const fn = flexibleThrottle(cb, 500, { leading: false, tailing: true }, mockDateNow);
        // although the default and the previous call use 500 timeout, but the override value 300 will change the tailing point
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 0],
          [200, 300, 0],
          [301, -1, 1],
          [2000, -1, 1],
        ]);
      });

      it("should add a new tailing if the previous tailing already ends but still in cool down according to the override timeout", () => {
        const fn = flexibleThrottle(cb, 500, { leading: false, tailing: true }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 0],
          [501, -1, 1],
          [800, 1000, 1],
          [1001, -1, 2],
          [2000, -1, 2],
        ]);
      });

      it("should start a new group after the tailing point be overrided", () => {
        const fn = flexibleThrottle(cb, 500, { leading: false, tailing: true }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 0],
          [200, 300, 0],
          [301, -1, 1],
          [400, 200, 1],
          [501, -1, 1],
          [601, -1, 2],
          [2000, -1, 2],
        ]);
      });
    });

    describe("leading and tailing", () => {
      it("should use override parameter to set timer", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: true }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 1000, 1],
          [501, 1000, 1],
          [1001, -1, 2],
          [1100, 1000, 3],
          [1500, 1000, 3],
          [2500, -1, 4],
        ]);
      });

      it("should not delay the tailing point based on the override value", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: true }, mockDateNow);
        // the tailing call should happen at 500, although the override value is 1000, the tailing should not be changed
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 1],
          [200, 1000, 1],
          [501, -1, 2],
          [2000, -1, 2],
        ]);
      });

      it("should modify the tailing point if override to a shorter time", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: true }, mockDateNow);
        // although the default and the previous call use 500 timeout, but the override value 300 will change the tailing point
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 1],
          [200, 300, 1],
          [301, -1, 2],
          [2000, -1, 2],
        ]);
      });

      it("should add a new tailing if the previous tailing already ends but still in cool down according to the override timeout", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: true }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 1],
          [100, 500, 1],
          [501, -1, 2],
          [800, 1000, 2],
          [1001, -1, 3],
          [2000, -1, 3],
        ]);
      });

      it("should start a new group after the tailing point be overrided", () => {
        const fn = flexibleThrottle(cb, 500, { leading: true, tailing: true }, mockDateNow);
        expectHaveBeenCalledWithOverrideAtTime(fn, cb, [
          [0, 500, 1],
          [200, 300, 1],
          [301, -1, 2],
          [400, 200, 3],
          [501, -1, 3],
          [601, -1, 3],
          [2000, -1, 3],
        ]);
      });
    });
  });
});
