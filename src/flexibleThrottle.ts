
type ThrottlingOptions = {
  leading?: boolean;
  tailing?: boolean;
  jitter?: () => number;
};

const defaultOptions: ThrottlingOptions = { leading: true, tailing: true, jitter: undefined };

export const flexibleThrottle = (
  fn: () => void,
  timeoutDefault = 0,
  options?: ThrottlingOptions,
  dateNow = Date.now // for test purpose
): ((timeoutOverride?: number) => void) => {
  let timer: ReturnType<typeof setTimeout>;
  let leadingTime = 0;
  let tailingTime = 0;
  let shouldCallAtTailing = false;

  options = Object.assign({}, defaultOptions, options);

  if (typeof fn !== "function") {
    return;
  }

  if (!Number.isFinite(timeoutDefault) || timeoutDefault < 0) {
    return;
  }

  if (options.leading !== true && options.tailing !== true) {
    return;
  }

  const wrappedFn = () => {
    cleanTimer();
    fn();
  };

  const isLeading = (timeout: number): boolean => leadingTime === 0 || dateNow() - leadingTime > timeout;

  const setTailing = (timeout: number) => {
    // in our scenario, we always try to shrink the cool down time. If we want a different options, e.g. always
    // expand the cool down, or the first win, or the last win, we should set it as an option.
    const newTailingTime = leadingTime + timeout;
    if (timer == null || newTailingTime < tailingTime) {
      setTimer(timeout);
    }
    shouldCallAtTailing = true;
  };

  const cleanTimer = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = undefined;
      tailingTime = 0;
    }
  };

  const setTimer = (timeout: number) => {
    cleanTimer();
    const remainTime = leadingTime + timeout - dateNow();
    const jitter = options?.jitter;
    const thisTimeout = Math.max(remainTime + (typeof jitter === "function" ? jitter() : 0), 0);
    tailingTime = dateNow() + thisTimeout;
    shouldCallAtTailing = false;
    timer = setTimeout(atTailing, thisTimeout);
  };

  const atTailing = () => {
    tailingTime = 0;
    if (shouldCallAtTailing) {
      wrappedFn();
    }
  };

  return function throttledFunction(timeoutOverride = timeoutDefault) {
    if (isLeading(timeoutOverride)) {
      leadingTime = dateNow();
      if (options.leading) {
        wrappedFn();
      }
      setTimer(timeoutOverride);
      if (!options.leading) {
        shouldCallAtTailing = true;
      }
    } else if (options.tailing) {
      setTailing(timeoutOverride);
    }
  };
};
