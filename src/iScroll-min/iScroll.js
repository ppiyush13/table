import { keyMap, getTime } from './utils';
import { vendorStyles } from './vendor-styles';
import {
  addEvent,
  removeEvent,
  preventDefaultException,
  getTouchAction,
  eventType,
} from './event';
import { momentum } from './momentum';
import { hasPointer, hasTouch } from './sniff-feature';
import { offset, getRect } from './offset';
import { easeFns } from './ease-fns';

export default function IScroll(el, options) {
  this.wrapper = typeof el === 'string' ? document.querySelector(el) : el;
  this.scroller = this.wrapper.children[0];

  this.options = {
    keyBindings: false,
    arrowKeyDisplacement: 40,

    // INSERT POINT: OPTIONS
    disablePointer: !hasPointer,
    disableTouch: hasPointer || !hasTouch,
    disableMouse: hasPointer || hasTouch,
    startX: 0,
    startY: 0,
    scrollY: true,
    directionLockThreshold: 5,
    momentum: true,

    bounceTime: 600,
    bounceEasing: 'circular',

    preventDefault: true,
    preventDefaultException: { tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/ },

    bindToWrapper: typeof window.onmousedown === 'undefined',
    ...options,
  };

  // Normalize options
  this.options.eventPassthrough =
    this.options.eventPassthrough === true
      ? 'vertical'
      : this.options.eventPassthrough;
  this.options.preventDefault =
    !this.options.eventPassthrough && this.options.preventDefault;

  // If you want eventPassthrough I have to lock one of the axes
  this.options.scrollY =
    this.options.eventPassthrough === 'vertical' ? false : this.options.scrollY;
  this.options.scrollX =
    this.options.eventPassthrough === 'horizontal'
      ? false
      : this.options.scrollX;

  // With eventPassthrough we also need lockDirection mechanism
  this.options.freeScroll =
    this.options.freeScroll && !this.options.eventPassthrough;
  this.options.directionLockThreshold = this.options.eventPassthrough
    ? 0
    : this.options.directionLockThreshold;

  this.options.bounceEasingFn = easeFns[this.options.bounceEasing];

  this.options.resizePolling =
    this.options.resizePolling === undefined ? 60 : this.options.resizePolling;

  this.options.invertWheelDirection = this.options.invertWheelDirection
    ? -1
    : 1;

  // INSERT POINT: NORMALIZATION

  // Some defaults
  this.x = 0;
  this.y = 0;
  this.directionX = 0;
  this.directionY = 0;
  this._events = {};

  // INSERT POINT: DEFAULTS

  this._init();
  this.refresh();

  this.scrollTo(this.options.startX, this.options.startY);
  this.enable();
}

IScroll.prototype = {
  version: '5.2.0-snapshot',

  _init: function () {
    this._initEvents();

    if (this.options.mouseWheel) {
      this._initWheel();
    }
    if (this.options.keyBindings) {
      this._initKeys();
    }
  },

  destroy: function () {
    this._initEvents(true);
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = null;
    this._execEvent('destroy');
  },

  _start: function (e) {
    if (eventType[e.type] !== 1) {
      // React to left mouse button only
      if (e.button !== 0) {
        return;
      }
    }

    if (
      !this.enabled ||
      (this.initiated && eventType[e.type] !== this.initiated)
    ) {
      return;
    }

    if (
      this.options.preventDefault &&
      !preventDefaultException(e.target, this.options.preventDefaultException)
    ) {
      e.preventDefault();
    }

    const point = e.touches ? e.touches[0] : e;

    this.initiated = eventType[e.type];
    this.moved = false;
    this.distX = 0;
    this.distY = 0;
    this.directionX = 0;
    this.directionY = 0;
    this.directionLocked = 0;

    this.startTime = getTime();

    if (this.isAnimating) {
      this.isAnimating = false;
      this._execEvent('scrollEnd');
    }

    this.startX = this.x;
    this.startY = this.y;
    this.absStartX = this.x;
    this.absStartY = this.y;
    this.pointX = point.pageX;
    this.pointY = point.pageY;

    this._execEvent('beforeScrollStart');
  },

  _move: function (e) {
    if (!this.enabled || eventType[e.type] !== this.initiated) {
      return;
    }

    if (this.options.preventDefault) {
      // increases performance on Android? TODO: check!
      e.preventDefault();
    }

    const point = e.touches ? e.touches[0] : e;
    const timestamp = getTime();
    let deltaX = point.pageX - this.pointX;
    let deltaY = point.pageY - this.pointY;
    let newX, newY, absDistX, absDistY;

    this.pointX = point.pageX;
    this.pointY = point.pageY;

    this.distX += deltaX;
    this.distY += deltaY;
    absDistX = Math.abs(this.distX);
    absDistY = Math.abs(this.distY);

    // We need to move at least 10 pixels for the scrolling to initiate
    if (timestamp - this.endTime > 300 && absDistX < 10 && absDistY < 10) {
      return;
    }

    // If you are scrolling in one direction lock the other
    if (!this.directionLocked && !this.options.freeScroll) {
      if (absDistX > absDistY + this.options.directionLockThreshold) {
        this.directionLocked = 'h'; // lock horizontally
      } else if (absDistY >= absDistX + this.options.directionLockThreshold) {
        this.directionLocked = 'v'; // lock vertically
      } else {
        this.directionLocked = 'n'; // no lock
      }
    }

    if (this.directionLocked === 'h') {
      if (this.options.eventPassthrough === 'vertical') {
        e.preventDefault();
      } else if (this.options.eventPassthrough === 'horizontal') {
        this.initiated = false;
        return;
      }

      deltaY = 0;
    } else if (this.directionLocked === 'v') {
      if (this.options.eventPassthrough === 'horizontal') {
        e.preventDefault();
      } else if (this.options.eventPassthrough === 'vertical') {
        this.initiated = false;
        return;
      }

      deltaX = 0;
    }

    deltaX = this.hasHorizontalScroll ? deltaX : 0;
    deltaY = this.hasVerticalScroll ? deltaY : 0;

    newX = this.x + deltaX;
    newY = this.y + deltaY;

    // Slow down if outside of the boundaries
    if (newX > 0 || newX < this.maxScrollX) {
      newX = newX > 0 ? 0 : this.maxScrollX;
    }
    if (newY > 0 || newY < this.maxScrollY) {
      newY = newY > 0 ? 0 : this.maxScrollY;
    }

    this.directionX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
    this.directionY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

    if (!this.moved) {
      this._execEvent('scrollStart');
    }

    this.moved = true;

    this._translate(newX, newY);

    /* REPLACE START: _move */
    if (timestamp - this.startTime > 300) {
      this.startTime = timestamp;
      this.startX = this.x;
      this.startY = this.y;

      if (this.options.probeType === 1) {
        this._execEvent('scroll');
      }
    }

    if (this.options.probeType > 1) {
      this._execEvent('scroll');
    }
    /* REPLACE END: _move */
  },

  _end: function (e) {
    if (!this.enabled || eventType[e.type] !== this.initiated) {
      return;
    }

    if (
      this.options.preventDefault &&
      !preventDefaultException(e.target, this.options.preventDefaultException)
    ) {
      e.preventDefault();
    }

    let newX = Math.round(this.x);
    let newY = Math.round(this.y);
    let time = 0;
    const duration = getTime() - this.startTime;
    const distanceX = Math.abs(newX - this.startX);
    const distanceY = Math.abs(newY - this.startY);

    this.initiated = 0;
    this.endTime = getTime();

    // reset if we are outside of the boundaries
    if (this.resetPosition(this.options.bounceTime)) {
      return;
    }

    this.scrollTo(newX, newY); // ensures that the last position is rounded

    // we scrolled less than 10 pixels
    if (!this.moved) {
      this._execEvent('scrollCancel');
      return;
    }

    if (
      this._events.flick &&
      duration < 200 &&
      distanceX < 100 &&
      distanceY < 100
    ) {
      this._execEvent('flick');
      return;
    }

    // start momentum animation if needed
    if (this.options.momentum && duration < 300) {
      const momentumX = this.hasHorizontalScroll
        ? momentum(
            this.x,
            this.startX,
            duration,
            this.maxScrollX,
            0,
            this.options.deceleration
          )
        : { destination: newX, duration: 0 };
      const momentumY = this.hasVerticalScroll
        ? momentum(
            this.y,
            this.startY,
            duration,
            this.maxScrollY,
            0,
            this.options.deceleration
          )
        : { destination: newY, duration: 0 };
      newX = momentumX.destination;
      newY = momentumY.destination;
      time = Math.max(momentumX.duration, momentumY.duration);
    }

    // INSERT POINT: _end

    if (newX !== this.x || newY !== this.y) {
      let easing = undefined;
      // change easing function when scroller goes out of the boundaries
      if (
        newX > 0 ||
        newX < this.maxScrollX ||
        newY > 0 ||
        newY < this.maxScrollY
      ) {
        easing = easeFns.quadratic;
      }

      this.scrollTo(newX, newY, time, easing);
      return;
    }

    this._execEvent('scrollEnd');
  },

  _resize: function () {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(
      () => this.refresh(),
      this.options.resizePolling
    );
  },

  resetPosition: function (time) {
    let x = this.x;
    let y = this.y;

    time = time || 0;

    if (!this.hasHorizontalScroll || this.x > 0) {
      x = 0;
    } else if (this.x < this.maxScrollX) {
      x = this.maxScrollX;
    }

    if (!this.hasVerticalScroll || this.y > 0) {
      y = 0;
    } else if (this.y < this.maxScrollY) {
      y = this.maxScrollY;
    }

    if (x === this.x && y === this.y) {
      return false;
    } else {
      this.scrollTo(x, y, time, this.options.bounceEasingFn);
      return true;
    }
  },

  disable: function () {
    this.enabled = false;
  },

  enable: function () {
    this.enabled = true;
  },

  enableMouseEvents: function () {
    this.enable = true;
    this._initMouseEvents();
  },

  disableMouseEvents: function () {
    this.enable = false;
    this._initMouseEvents(true);
  },

  refresh: function () {
    getRect(this.wrapper); // Force reflow

    this.wrapperWidth = this.wrapper.clientWidth;
    this.wrapperHeight = this.wrapper.clientHeight;

    const rect = getRect(this.scroller);
    /* REPLACE START: refresh */

    this.scrollerWidth = rect.width;
    this.scrollerHeight = rect.height;

    this.maxScrollX = this.wrapperWidth - this.scrollerWidth;
    this.maxScrollY = this.wrapperHeight - this.scrollerHeight;

    /* REPLACE END: refresh */

    this.hasHorizontalScroll = this.options.scrollX && this.maxScrollX < 0;
    this.hasVerticalScroll = this.options.scrollY && this.maxScrollY < 0;

    if (!this.hasHorizontalScroll) {
      this.maxScrollX = 0;
      this.scrollerWidth = this.wrapperWidth;
    }

    if (!this.hasVerticalScroll) {
      this.maxScrollY = 0;
      this.scrollerHeight = this.wrapperHeight;
    }

    this.endTime = 0;
    this.directionX = 0;
    this.directionY = 0;

    if (hasPointer && !this.options.disablePointer) {
      // The wrapper should have `touchAction` property for using pointerEvent.
      this.wrapper.style[vendorStyles.touchAction] = getTouchAction(
        this.options.eventPassthrough,
        true
      );

      // case. not support 'pinch-zoom'
      // https://github.com/cubiq/iscroll/issues/1118#issuecomment-270057583
      if (!this.wrapper.style[vendorStyles.touchAction]) {
        this.wrapper.style[vendorStyles.touchAction] = getTouchAction(
          this.options.eventPassthrough,
          false
        );
      }
    }
    this.wrapperOffset = offset(this.wrapper);

    this._execEvent('refresh');

    this.resetPosition();

    // INSERT POINT: _refresh
  },

  on: function (type, fn) {
    if (!this._events[type]) {
      this._events[type] = [];
    }

    this._events[type].push(fn);
  },

  off: function (type, fn) {
    if (!this._events[type]) {
      return;
    }

    const index = this._events[type].indexOf(fn);

    if (index > -1) {
      this._events[type].splice(index, 1);
    }
  },

  _execEvent: function (type, ...args) {
    if (!this._events[type]) {
      return;
    }

    const eventListeners = this._events[type];
    eventListeners.forEach((eventListner) => eventListner(...args));
  },

  scrollBy: function (x, y, time, easing) {
    x = this.x + x;
    y = this.y + y;
    time = time || 0;

    this.scrollTo(x, y, time, easing);
  },

  scrollTo: function (x, y, time, easing = easeFns.circular) {
    if (time) {
      this._animate(x, y, time, easing.fn);
    } else {
      this._translate(x, y);
    }
  },

  scrollToElement: function (el, time, offsetX, offsetY, easing) {
    el = el.nodeType ? el : this.scroller.querySelector(el);

    if (!el) {
      return;
    }

    const pos = offset(el);

    pos.left -= this.wrapperOffset.left;
    pos.top -= this.wrapperOffset.top;

    // if offsetX/Y are true we center the element to the screen
    const elRect = getRect(el);
    const wrapperRect = getRect(this.wrapper);
    if (offsetX === true) {
      offsetX = Math.round(elRect.width / 2 - wrapperRect.width / 2);
    }
    if (offsetY === true) {
      offsetY = Math.round(elRect.height / 2 - wrapperRect.height / 2);
    }

    pos.left -= offsetX || 0;
    pos.top -= offsetY || 0;

    pos.left =
      pos.left > 0
        ? 0
        : pos.left < this.maxScrollX
        ? this.maxScrollX
        : pos.left;
    pos.top =
      pos.top > 0 ? 0 : pos.top < this.maxScrollY ? this.maxScrollY : pos.top;

    time =
      time === undefined || time === null || time === 'auto'
        ? Math.max(Math.abs(this.x - pos.left), Math.abs(this.y - pos.top))
        : time;

    this.scrollTo(pos.left, pos.top, time, easing);
  },

  _translate: function (x, y) {
    this.x = x;
    this.y = y;
    this._execEvent('translate', x * -1, y);
  },

  _initMouseEvents: function (remove) {
    const eventType = remove ? removeEvent : addEvent;
    const target = this.options.bindToWrapper ? this.wrapper : window;

    if (!this.options.disableMouse) {
      eventType(this.wrapper, 'mousedown', this);
      eventType(target, 'mousemove', this);
      eventType(target, 'mousecancel', this);
      eventType(target, 'mouseup', this);
    }

    if (hasPointer && !this.options.disablePointer) {
      eventType(this.wrapper, 'pointerdown', this);
      eventType(target, 'pointermove', this);
      eventType(target, 'pointercancel', this);
      eventType(target, 'pointerup', this);
    }

    if (hasTouch && !this.options.disableTouch) {
      eventType(this.wrapper, 'touchstart', this);
      eventType(target, 'touchmove', this);
      eventType(target, 'touchcancel', this);
      eventType(target, 'touchend', this);
    }
  },

  _initEvents: function (remove) {
    const eventType = remove ? removeEvent : addEvent;
    const target = this.options.bindToWrapper ? this.wrapper : window;

    eventType(window, 'orientationchange', this);
    eventType(window, 'resize', this);

    if (this.options.click) {
      eventType(this.wrapper, 'click', this, true);
    }
    this._initMouseEvents(remove);
  },

  _initWheel: function () {
    addEvent(this.wrapper, 'wheel', this);
    addEvent(this.wrapper, 'mousewheel', this);
    addEvent(this.wrapper, 'DOMMouseScroll', this);

    this.on('destroy', () => {
      clearTimeout(this.wheelTimeout);
      this.wheelTimeout = null;
      removeEvent(this.wrapper, 'wheel', this);
      removeEvent(this.wrapper, 'mousewheel', this);
      removeEvent(this.wrapper, 'DOMMouseScroll', this);
    });
  },

  _wheel: function (e) {
    if (!this.enabled) {
      return;
    }

    let wheelDeltaX;
    let wheelDeltaY;
    let newX;
    let newY;

    if (this.wheelTimeout === undefined) {
      this._execEvent('scrollStart');
    }

    // Execute the scrollEnd event after 400ms the wheel stopped scrolling
    clearTimeout(this.wheelTimeout);
    this.wheelTimeout = setTimeout(() => {
      if (!this.options.snap) {
        this._execEvent('scrollEnd');
      }
      this.wheelTimeout = undefined;
    }, 400);

    if ('deltaX' in e) {
      if (e.deltaMode === 1) {
        wheelDeltaX = -e.deltaX * this.options.mouseWheelSpeed;
        wheelDeltaY = -e.deltaY * this.options.mouseWheelSpeed;
      } else {
        wheelDeltaX = -e.deltaX;
        wheelDeltaY = -e.deltaY;
      }
    } else if ('wheelDeltaX' in e) {
      wheelDeltaX = (e.wheelDeltaX / 120) * this.options.mouseWheelSpeed;
      wheelDeltaY = (e.wheelDeltaY / 120) * this.options.mouseWheelSpeed;
    } else if ('wheelDelta' in e) {
      wheelDeltaX = wheelDeltaY =
        (e.wheelDelta / 120) * this.options.mouseWheelSpeed;
    } else if ('detail' in e) {
      wheelDeltaX = wheelDeltaY =
        (-e.detail / 3) * this.options.mouseWheelSpeed;
    } else {
      return;
    }

    wheelDeltaX *= this.options.invertWheelDirection;
    wheelDeltaY *= this.options.invertWheelDirection;

    if (wheelDeltaX === 0 && !this.hasHorizontalScroll) return;
    else if (wheelDeltaX === 0 && !this.hasVerticalScroll) return;

    e.preventDefault();

    newX = this.x + Math.round(this.hasHorizontalScroll ? wheelDeltaX : 0);
    newY = this.y + Math.round(this.hasVerticalScroll ? wheelDeltaY : 0);

    this.directionX = wheelDeltaX > 0 ? -1 : wheelDeltaX < 0 ? 1 : 0;
    this.directionY = wheelDeltaY > 0 ? -1 : wheelDeltaY < 0 ? 1 : 0;

    if (newX > 0) {
      newX = 0;
    } else if (newX < this.maxScrollX) {
      newX = this.maxScrollX;
    }

    if (newY > 0) {
      newY = 0;
    } else if (newY < this.maxScrollY) {
      newY = this.maxScrollY;
    }

    this.scrollTo(newX, newY, 0);

    if (this.options.probeType > 1) {
      this._execEvent('scroll');
    }

    // INSERT POINT: _wheel
  },

  _initKeys: function (e) {
    // default key bindings
    addEvent(window, 'keydown', this);

    this.on('destroy', () => {
      removeEvent(window, 'keydown', this);
    });
  },

  _key: function (e) {
    if (!this.enabled) {
      return;
    }

    const now = getTime();
    const prevTime = this.keyTime || 0;
    const acceleration = 0.25;
    let newX = this.x;
    let newY = this.y;

    this.keyAcceleration =
      now - prevTime < 200
        ? Math.min(this.keyAcceleration + acceleration, 50)
        : 0;

    switch (e.keyCode) {
      case keyMap.left:
        if (!this.hasHorizontalScroll) return;
        newX += (this.options.arrowKeyDisplacement + this.keyAcceleration) >> 0;
        break;
      case keyMap.up:
        if (!this.hasVerticalScroll) return;
        newY += (this.options.arrowKeyDisplacement + this.keyAcceleration) >> 0;
        break;
      case keyMap.right:
        if (!this.hasHorizontalScroll) return;
        newX -= (this.options.arrowKeyDisplacement + this.keyAcceleration) >> 0;
        break;
      case keyMap.down:
        if (!this.hasVerticalScroll) return;
        newY -= (this.options.arrowKeyDisplacement + this.keyAcceleration) >> 0;
        break;
      default:
        return;
    }

    if (newX > 0) {
      newX = 0;
      this.keyAcceleration = 0;
    } else if (newX < this.maxScrollX) {
      newX = this.maxScrollX;
      this.keyAcceleration = 0;
    }

    if (newY > 0) {
      newY = 0;
      this.keyAcceleration = 0;
    } else if (newY < this.maxScrollY) {
      newY = this.maxScrollY;
      this.keyAcceleration = 0;
    }

    this.scrollTo(newX, newY, 120);
    this.keyTime = now;
  },

  _animate: function (destX, destY, duration, easingFn) {
    const startX = this.x;
    const startY = this.y;
    const startTime = getTime();
    const destTime = startTime + duration;

    const step = () => {
      const now = getTime();

      if (now >= destTime) {
        this.isAnimating = false;
        this._translate(destX, destY);

        if (!this.resetPosition(this.options.bounceTime)) {
          this._execEvent('scrollEnd');
        }

        return;
      }

      const easeTime = (now - startTime) / duration;
      const easing = easingFn(easeTime);
      const newX = (destX - startX) * easing + startX;
      const newY = (destY - startY) * easing + startY;
      this._translate(newX, newY);

      if (this.isAnimating) {
        window.requestAnimationFrame(step);
      }

      if (this.options.probeType === 3) {
        this._execEvent('scroll');
      }
    };

    this.isAnimating = true;
    step();
  },

  handleEvent: function (e) {
    switch (e.type) {
      case 'touchstart':
      case 'pointerdown':
      case 'MSPointerDown':
      case 'mousedown':
        this._start(e);
        break;
      case 'touchmove':
      case 'pointermove':
      case 'MSPointerMove':
      case 'mousemove':
        this._move(e);
        break;
      case 'touchend':
      case 'pointerup':
      case 'MSPointerUp':
      case 'mouseup':
      case 'touchcancel':
      case 'pointercancel':
      case 'MSPointerCancel':
      case 'mousecancel':
        this._end(e);
        break;
      case 'wheel':
      case 'DOMMouseScroll':
      case 'mousewheel':
        this._wheel(e);
        break;
      case 'orientationchange':
      case 'resize':
        this._resize();
        break;
      case 'keydown':
        this._key(e);
        break;
      case 'click':
        if (this.enabled && !e._constructed) {
          e.preventDefault();
          e.stopPropagation();
        }
        break;
      default:
        return;
    }
  },
};
